/// <reference path="type.ts" />
/// <reference path="ast.ts" />
/// <reference path="visit.ts" />
/// <reference path="pretty.ts" />


// An environment consists of:
// - A stack stack with the current stage at the front of the list. Prior
//   stages are to the right. Normal accesses must refer to the top
//   environment frame; subsequent ones are "auto-persists".
// - A single frame for "extern" values, which are always available without
//   any persisting.
// - A map for *named types*. Unlike the other maps, each entry here
//   represents a *type*, not a variable.
type TypeEnv = [TypeMap[], TypeMap, TypeMap];


// The type checker.
// The checker is written as a "function generator," and we'll later take its
// fixed point to get an ordinary type checker function (of type `TypeCheck`,
// below).

type TypeCheck = (tree: SyntaxNode, env: TypeEnv) => [Type, TypeEnv];
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
      let [stack, externs, named] = e;
      let head = overlay(hd(stack)); // Update type in an overlay environment.
      head[tree.ident] = t;
      let e2: TypeEnv = [cons(head, tl(stack)), externs, named];

      return [t, e2];
    },

    visit_assign(tree: AssignNode, env: TypeEnv): [Type, TypeEnv] {
      let [stack, externs, _] = env;

      // Check the value expression.
      let [expr_t, e] = check(tree.expr, env);

      // Check that the new value is compatible with the variable's type.
      // Try a normal variable first.
      let [var_t, __] = stack_lookup(stack, tree.ident);
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
      let [stack, externs, _] = env;

      // Try a normal variable first.
      let [t, __] = stack_lookup(stack, tree.ident);
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
      let [stack, externs, named] = env;
      let inner_env: TypeEnv = [cons(<TypeMap> {}, stack), externs, named];

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
      let [stack, externs, named] = env;
      let inner_env: TypeEnv = [tl(stack), externs, named];
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
      let [stack, externs, named] = env;

      // Get the list of declared parameter types and accumulate them in an
      // environment based on the top of the environment stack.
      let param_types : Type[] = [];
      let body_env_hd = overlay(hd(stack));
      for (let param of tree.params) {
        let ptype = get_type(param.type, named);
        param_types.push(ptype);
        body_env_hd[param.name] = ptype;
      }

      // Check the body and get the return type.
      let body_env: TypeEnv = [cons(body_env_hd, tl(stack)), externs, named];
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
      let [stack, externs, named] = env;

      // Add the type to the extern map.
      let new_externs = overlay(externs);
      let type = get_type(tree.type, named);
      externs[tree.name] = type;
      let e: TypeEnv = [stack, new_externs, named];

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
let get_type_rules: TypeASTVisit<TypeMap, Type> = {
  visit_primitive(tree: PrimitiveTypeNode, types: TypeMap) {
    let t = types[tree.name];
    if (t !== undefined) {
      return t;
    } else {
      throw "error: unknown primitive type " + tree.name;
    }
  },

  visit_fun(tree: FunTypeNode, types: TypeMap) {
    let params: Type[] = [];
    for (let param_node of tree.params) {
      params.push(get_type(param_node, types));
    }
    let ret = get_type(tree.ret, types);

    return new FunType(params, ret);
  },

  visit_code(tree: CodeTypeNode, types: TypeMap) {
    let inner = get_type(tree.inner, types);
    return new CodeType(inner);
  },
};

function get_type(ttree: TypeNode, types: TypeMap): Type {
  return type_ast_visit(get_type_rules, ttree, types);
}
