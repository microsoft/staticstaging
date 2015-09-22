/// <reference path="ast.ts" />
/// <reference path="visit.ts" />
/// <reference path="util.ts" />
/// <reference path="pretty.ts" />

// The kinds of types.
type Type = IntType | FunType | CodeType;

// There is only one Int type.
class IntType {
  // A workaround to compensate for TypeScript's structural subtyping:
  // https://github.com/Microsoft/TypeScript/issues/202
  _nominal_IntType: void;
};
const INT = new IntType();

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

// An environment is a stack stack with the current stage at the front of the
// list. Prior stages are to the right. Normal accesses must refer to the top
// environment frame; subsequent ones are "auto-persists".
type TypeEnv = TypeEnvFrame[];


// Type rules.

// EXPERIMENTAL
type Gen <T> = (_:T) => T;
type TypeCheck = (tree: SyntaxNode, [env, level]: [TypeEnv, number]) => [Type, TypeEnv];
let gen_check : Gen<TypeCheck> = function(fself) {
  // Shorthand for the recursive call.
  function check(tree: SyntaxNode, env: TypeEnv, level: number):
      [Type, TypeEnv] {
    return fself(tree, [env, level]);
  }

  let type_rules : ASTVisit<[TypeEnv, number], [Type, TypeEnv]> = {
    visit_literal(tree, [env, level]) {
      return [INT, env];
    },
    visit_seq(tree, [env, level]) {
      return [INT, env];
    },
    visit_let(tree, [env, level]) {
      return [INT, env];
    },
    visit_lookup(tree, [env, level]) {
      return [INT, env];
    },
    visit_binary(tree, [env, level]) {
      return [INT, env];
    },
    visit_quote(tree, [env, level]) {
      return [INT, env];
    },
    visit_escape(tree, [env, level]) {
      return [INT, env];
    },
    visit_run(tree, [env, level]) {
      return [INT, env];
    },
    visit_fun(tree, [env, level]) {
      return [INT, env];
    },
    visit_call(tree, [env, level]) {
      return [INT, env];
    },
    visit_persist(tree, [env, level]) {
      return [INT, env];
    },
  };

  return function (tree, [env, level]) {
    return ast_visit(type_rules, tree, [env, level]);
  }
}

let Typecheck : ASTVisit<[TypeEnv, number], [Type, TypeEnv]> = {
  visit_literal(tree: LiteralNode, [env, level]: [TypeEnv, number]):
      [Type, TypeEnv] {
    return [INT, env];
  },

  visit_seq(tree: SeqNode, [env, level]: [TypeEnv, number]): [Type, TypeEnv] {
    let [t, e] = check(tree.lhs, env, level);
    return check(tree.rhs, e, level);
  },

  visit_let(tree: LetNode, [env, level]: [TypeEnv, number]): [Type, TypeEnv] {
    let [t, e] = check(tree.expr, env, level);
    let head = overlay(hd(e)); // Update type in an overlay environment.
    head[tree.ident] = t;
    let e2 = cons(head, tl(e));
    return [t, e2];
  },

  visit_lookup(tree: LookupNode, [env, level]: [TypeEnv, number]):
      [Type, TypeEnv] {
    let t = hd(env)[tree.ident];
    if (t === undefined) {
      throw "type error: undefined variable " + tree.ident;
    }
    return [t, env];
  },

  visit_binary(tree: BinaryNode, [env, level]: [TypeEnv, number]):
      [Type, TypeEnv] {
    let [t1, e1] = check(tree.lhs, env, level);
    let [t2, e2] = check(tree.rhs, e1, level);
    if (t1 instanceof IntType && t2 instanceof IntType) {
      return [INT, env];
    } else {
      throw "type error: binary operation on non-numbers (" +
        pretty_type(t1) + " " + tree.op + " " + pretty_type(t2) + ")";
    }
  },

  visit_quote(tree: QuoteNode, [env, level]: [TypeEnv, number]):
      [Type, TypeEnv] {
    // Push an empty stack frame and check inside the quote.
    let inner_env = cons(<TypeEnvFrame> {}, env);
    let [t, e] = check(tree.expr, inner_env, level + 1);

    // Move the result type "down" to a code type.
    return [new CodeType(t), env];
  },

  visit_escape(tree: EscapeNode, [env, level]: [TypeEnv, number]):
      [Type, TypeEnv] {
    // Escaping beyond the top level is not allowed.
    if (level == 0) {
      throw "type error: top-level escape";
    }

    // Pop the current (quotation) environment off of the environment stack
    // before checking the escape.
    let inner_env = tl(env);
    let [t, e] = check(tree.expr, inner_env, level - 1);

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

  visit_run(tree: RunNode, [env, level]: [TypeEnv, number]): [Type, TypeEnv] {
    let [t, e] = check(tree.expr, env, level);
    if (t instanceof CodeType) {
      return [t.inner, e];
    } else {
      throw "type error: running a non-code type " + pretty_type(t);
    }
  },

  visit_fun(tree: FunNode, [env, level]: [TypeEnv, number]): [Type, TypeEnv] {
    // Get the list of declared parameter types and accumulate them in an
    // environment based on the top of the environment stack.
    let param_types : Type[] = [];
    let body_env_hd = overlay(hd(env));
    for (let param of tree.params) {
      let ptype : Type;
      if (param.type == "Int") {
        ptype = INT;
      } else {
        throw "TODO: parameters must be Int for now";
      }
      param_types.push(ptype);
      body_env_hd[param.name] = ptype;
    }

    // Check the body and get the return type.
    let body_env = cons(body_env_hd, tl(env));
    let [ret_type, _] = check(tree.body, body_env, level);

    // Construct the function type.
    let fun_type = new FunType(param_types, ret_type);
    return [fun_type, env];
  },

  visit_call(tree: CallNode, [env, level]: [TypeEnv, number]):
      [Type, TypeEnv] {
    // Check the type of the thing we're calling. It must be a function.
    let [target_type, e] = check(tree.fun, env, level);
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
      [arg_type, e] = check(arg, e, level);
      if (!compatible(param_type, arg_type)) {
        throw "type error: mismatched argument type at index " + i +
          ": expected " + pretty_type(param_type) +
          ", got " + pretty_type(arg_type);
      }
    }

    // Yield the result type.
    return [fun_type.ret, e];
  },


  visit_persist(tree: PersistNode, [env, level]: [TypeEnv, number]):
      [Type, TypeEnv] {
    throw "error: persist cannot be type-checked in source code";
  },
}

// Check type compatibility.
function compatible(ltype: Type, rtype: Type): boolean {
  if (ltype instanceof IntType && rtype instanceof IntType) {
    return true;
  } else {
    throw "TODO: can't yet compare non-Int types";
  }
}

function check(tree: SyntaxNode, env: TypeEnv, level: number):
    [Type, TypeEnv] {
  return ast_visit(Typecheck, tree, [env, level]);
}

function typecheck(tree: SyntaxNode): Type {
  let [t, e] = check(tree, [{}], 0);
  return t;
}
