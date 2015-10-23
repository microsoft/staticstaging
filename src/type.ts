/// <reference path="ast.ts" />
/// <reference path="visit.ts" />
/// <reference path="util.ts" />
/// <reference path="pretty.ts" />

// The kinds of types.
type Type = PrimitiveType | FunType | CodeType;

// Primitive types are singular instances.
class PrimitiveType {
  constructor(public name: string) {};

  // A workaround to compensate for TypeScript's structural subtyping:
  // https://github.com/Microsoft/TypeScript/issues/202
  _brand_PrimitiveType: void;
};
const INT = new PrimitiveType("Int");
const FLOAT = new PrimitiveType("Float");

// But function types are more complicated. Really wishing for ADTs here.
class FunType {
  constructor(public params: Type[], public ret: Type) {};
  _nominal_FunType: void;
};

// Same with code types.
class CodeType {
  constructor(public inner: Type) {};
  _nominal_CodeType: void;
};

// A single frame in a type environment holds all the bindings for one stage.
interface TypeEnvFrame {
  [key: string]: Type;
}

// An environment consists of:
// - A stack stack with the current stage at the front of the list. Prior
//   stages are to the right. Normal accesses must refer to the top
//   environment frame; subsequent ones are "auto-persists".
// - A single frame for "extern" values, which are always available without
//   any persisting.
type TypeEnv = [TypeEnvFrame[], TypeEnvFrame];


// The type checker.
// The checker is written as a "function generator," and we'll later take its
// fixed point to get an ordinary type checker function (of type `TypeCheck`,
// below).

type TypeCheck = (tree: SyntaxNode, env: TypeEnv)
                 => [Type, TypeEnv];
let gen_check : Gen<TypeCheck> = function(check) {
  let type_rules : ASTVisit<TypeEnv, [Type, TypeEnv]> = {
    visit_literal(tree: LiteralNode, env: TypeEnv): [Type, TypeEnv] {
      if (tree.type === "int") {
        return [INT, env];
      } else if (tree.type === "float") {
        return [FLOAT, env];
      } else {
        throw "error: unknown literal type";
      }
    },

    visit_seq(tree: SeqNode, env: TypeEnv): [Type, TypeEnv] {
      let [t, e] = check(tree.lhs, env);
      return check(tree.rhs, e);
    },

    visit_let(tree: LetNode, env: TypeEnv): [Type, TypeEnv] {
      // Check the assignment expression.
      let [t, e] = check(tree.expr, env);

      // Insert the new type into the front of the map stack.
      let [stack, externs] = e;
      let head = overlay(hd(stack)); // Update type in an overlay environment.
      head[tree.ident] = t;
      let e2: TypeEnv = [cons(head, tl(stack)), externs];

      return [t, e2];
    },

    visit_assign(tree: AssignNode, env: TypeEnv): [Type, TypeEnv] {
      let [stack, externs] = env;

      // Check the value expression.
      let [expr_t, e] = check(tree.expr, env);

      // Check that the new value is compatible with the variable's type.
      // Try a normal variable first.
      let [var_t, _] = stack_lookup(stack, tree.ident);
      if (var_t === undefined) {
        var_t = externs[tree.ident];
        if (var_t === undefined) {
          throw "type error: assignment to undeclared variable " + tree.ident;
        }
      }

      if (!compatible(var_t, expr_t)) {
        throw "type error: mismatched type in assigment: " +
          "expected " + pretty_type(var_t) +
          ", got " + pretty_type(expr_t);
      }

      return [var_t, e];
    },

    visit_lookup(tree: LookupNode, env: TypeEnv): [Type, TypeEnv] {
      let [stack, externs] = env;

      // Try a normal variable first.
      let [t, _] = stack_lookup(stack, tree.ident);
      if (t !== undefined) {
        return [t, env];
      }

      // Next, try looking for an extern.
      let et = externs[tree.ident];
      if (et !== undefined) {
        return [et, env];
      }

      throw "type error: undefined variable " + tree.ident;
    },

    visit_binary(tree: BinaryNode, env: TypeEnv): [Type, TypeEnv] {
      let [t1, e1] = check(tree.lhs, env);
      let [t2, e2] = check(tree.rhs, e1);
      if (t1 === INT && t2 === INT) {
        return [INT, env];
      } else if ((t1 === FLOAT || t1 === INT) &&
                 (t2 === FLOAT || t2 === INT)) {
        return [FLOAT, env];
      } else {
        throw "type error: binary operation on non-numbers (" +
          pretty_type(t1) + " " + tree.op + " " + pretty_type(t2) + ")";
      }
    },

    visit_quote(tree: QuoteNode, env: TypeEnv): [Type, TypeEnv] {
      // Push an empty stack frame.
      let [stack, externs] = env;
      let inner_env: TypeEnv = [cons(<TypeEnvFrame> {}, stack), externs];

      // Check inside the quote using the empty frame.
      let [t, e] = check(tree.expr, inner_env);

      // Move the result type "down" to a code type. Ignore any changes to the
      // environment.
      return [new CodeType(t), env];
    },

    visit_escape(tree: EscapeNode, env: TypeEnv): [Type, TypeEnv] {
      // Escaping beyond the top level is not allowed.
      let level = env.length;
      if (level == 0) {
        throw "type error: top-level escape";
      }

      // Pop the current (quotation) environment off of the environment stack
      // before checking the escape.
      let [stack, externs] = env;
      let inner_env: TypeEnv = [tl(stack), externs];
      let [t, e] = check(tree.expr, inner_env);

      if (tree.kind === "splice") {
        // The result of the escape's expression must be code, so it can be
        // spliced.
        if (t instanceof CodeType) {
          // Move the type "up" one stage.
          return [t.inner, env];
        } else {
          throw "type error: escape produced non-code value";
        }

      } else if (tree.kind === "persist") {
        // A persist escape has the same type as the outer type.
        return [t, env];

      } else {
        throw "error: unknown escape kind";
      }
    },

    visit_run(tree: RunNode, env: TypeEnv): [Type, TypeEnv] {
      let [t, e] = check(tree.expr, env);
      if (t instanceof CodeType) {
        return [t.inner, e];
      } else {
        throw "type error: running a non-code type " + pretty_type(t);
      }
    },

    visit_fun(tree: FunNode, env: TypeEnv): [Type, TypeEnv] {
      // Get the list of declared parameter types and accumulate them in an
      // environment based on the top of the environment stack.
      let param_types : Type[] = [];
      let [stack, externs] = env;
      let body_env_hd = overlay(hd(stack));
      for (let param of tree.params) {
        let ptype = get_type(param.type);
        param_types.push(ptype);
        body_env_hd[param.name] = ptype;
      }

      // Check the body and get the return type.
      let body_env: TypeEnv = [cons(body_env_hd, tl(stack)), externs];
      let [ret_type, _] = check(tree.body, body_env);

      // Construct the function type.
      let fun_type = new FunType(param_types, ret_type);
      return [fun_type, env];
    },

    visit_call(tree: CallNode, env: TypeEnv): [Type, TypeEnv] {
      // Check the type of the thing we're calling. It must be a function.
      let [target_type, e] = check(tree.fun, env);
      let fun_type : FunType;
      if (target_type instanceof FunType) {
        fun_type = target_type;
      } else {
        throw "type error: call of non-function";
      }

      // Check that the arguments are the right type.
      if (tree.args.length != fun_type.params.length) {
        throw "type error: mismatched argument length";
      }
      for (let i = 0; i < tree.args.length; ++i) {
        let arg = tree.args[i];
        let param_type = fun_type.params[i];

        let arg_type : Type;
        [arg_type, e] = check(arg, e);
        if (!compatible(param_type, arg_type)) {
          throw "type error: mismatched argument type at index " + i +
            ": expected " + pretty_type(param_type) +
            ", got " + pretty_type(arg_type);
        }
      }

      // Yield the result type.
      return [fun_type.ret, e];
    },

    visit_extern(tree: ExternNode, env: TypeEnv): [Type, TypeEnv] {
      let [stack, externs] = env;

      // Add the type to the extern map.
      let new_externs = overlay(externs);
      let type = get_type(tree.type);
      externs[tree.name] = type;
      let e: TypeEnv = [stack, new_externs];

      return [type, e];
    },

    visit_persist(tree: PersistNode, env: TypeEnv): [Type, TypeEnv] {
      throw "error: persist cannot be type-checked in source code";
    },
  };

  // The entry point for the recursion.
  return function (tree, env) {
    return ast_visit(type_rules, tree, env);
  }
}

// Check type compatibility.
function compatible(ltype: Type, rtype: Type): boolean {
  if (ltype === rtype) {
    return true;

  } else if (ltype === FLOAT && rtype === INT) {
    return true;

  } else if (ltype instanceof FunType && rtype instanceof FunType) {
    if (ltype.params.length != rtype.params.length) {
      return false;
    }
    for (let i = 0; i < ltype.params.length; ++i) {
      let lparam = ltype.params[i];
      let rparam = rtype.params[i];
      if (!compatible(rparam, lparam)) {  // Contravariant.
        return false;
      }
    }
    return compatible(ltype.ret, rtype.ret);  // Covariant.

  } else if (ltype instanceof CodeType && rtype instanceof CodeType) {
    return compatible(ltype.inner, rtype.inner);
  }

  return false;
}

// Get the Type denoted by the type syntax tree.
let get_type_rules: TypeASTVisit<void, Type> = {
  visit_primitive(tree: PrimitiveTypeNode, p: void) {
    if (tree.name === "Int") {
      return INT;
    } else if (tree.name === "Float") {
      return FLOAT;
    } else {
      throw "error: unknown primitive type " + tree.name;
    }
  },

  visit_fun(tree: FunTypeNode, p: void) {
    let params: Type[] = [];
    for (let param_node of tree.params) {
      params.push(get_type(param_node));
    }
    let ret = get_type(tree.ret);

    return new FunType(params, ret);
  },

  visit_code(tree: CodeTypeNode, p: void) {
    let inner = get_type(tree.inner);
    return new CodeType(inner);
  },
};
function get_type(ttree: TypeNode): Type {
  return type_ast_visit(get_type_rules, ttree, null);
}

// A shorthand for typechecking in an empty initial context.
let _typecheck : TypeCheck = fix(gen_check);
function typecheck(tree: SyntaxNode): Type {
  let [t, e] = _typecheck(tree, [[{}], {}]);
  return t;
}

// A container for elaborated type information.
type TypeTable = [Type, TypeEnv][];

// A functional mixin for the type checker that stores the results in a table
// on the side. The AST must be stamped with IDs.
function elaborate_mixin(type_table : TypeTable): Gen<TypeCheck> {
  return function(fsuper: TypeCheck): TypeCheck {
    return function(tree: SyntaxNode, env: TypeEnv): [Type, TypeEnv] {
      let [t, e] = fsuper(tree, env);
      type_table[tree.id] = [t, e];
      return [t, e];
    };
  };
}

// Deep copy an object structure and add IDs to every object.
function stamp <T> (o: T, start: number = 0): T & { id: number } {
  let id = start;

  function helper (o: any): any {
    if (o instanceof Array) {
      let out: any[] = [];
      for (let el of o) {
        out.push(helper(el));
      }
      return out;

    } else if (o instanceof Object) {
      let copy = merge(o);
      copy.id = id;
      ++id;

      for (let key in copy) {
        if (copy.hasOwnProperty(key)) {
          copy[key] = helper(copy[key]);
        }
      }

      return copy;
    } else {
      return o;
    }
  };

  return helper(o);
}

// A helper for elaboration that works on subtrees. You can start with an
// initial environment and a type table for other nodes; this will assign
// fresh IDs to the subtree and *append* to the type table.
function elaborate_subtree(tree: SyntaxNode, initial_env: TypeEnv,
                           type_table: TypeTable): SyntaxNode {
  let stamped_tree = stamp(tree, type_table.length);
  let _elaborate : TypeCheck = fix(compose(elaborate_mixin(type_table),
                                           gen_check));
  _elaborate(stamped_tree, initial_env);
  return stamped_tree;
}

// Type elaboration. Create a copy of the AST with ID stamps and a table that
// maps the IDs to type information.
function elaborate(tree: SyntaxNode): [SyntaxNode, TypeTable] {
  let table : TypeTable = [];
  let elaborated = elaborate_subtree(tree, [[{}], {}], table);
  return [elaborated, table];
}
