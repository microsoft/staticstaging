/// <reference path="ast.ts" />
/// <reference path="visit.ts" />

// Wishing for algebraic data types.
// type Type = BasicType | CodeType<T extends Type>;
class Type { }
class IntType extends Type { }
class CodeType extends Type {
  constructor(public valtype: Type) { super(); }
}

interface TypeEnv {
  [key: string]: Type;
}

// "Enquote" all the values in an environment.
function quote_env(e: TypeEnv): TypeEnv {
  let e2 : TypeEnv = {};
  for (let key in e) {
    let typ : Type = e[key];
    e2[key] = new CodeType(typ);
  }
  return e2;
}


// Type rules.

let Typecheck : ASTVisit<TypeEnv, [Type, TypeEnv]> = {
  visit_literal(tree: LiteralNode, env: TypeEnv): [Type, TypeEnv] {
    return [new IntType(), env];
  },

  visit_seq(tree: SeqNode, env: TypeEnv): [Type, TypeEnv] {
    let [t, e] = typecheck(tree.lhs, env);
    return typecheck(tree.rhs, e);
  },

  visit_let(tree: LetNode, env: TypeEnv): [Type, TypeEnv] {
    let [t, e] = typecheck(tree.expr, env);
    // Like the interpreter, we abuse prototypes to create an overlay
    // environment.
    let e2 = <TypeEnv> Object(e);
    e2[tree.ident] = t;
    return [v, e2];
  },

  visit_lookup(tree: LookupNode, env: TypeEnv): [Type, TypeEnv] {
    let t = env[tree.ident];
    if (t === undefined) {
      throw "type error: undefined variable " + tree.ident;
    }
    return [t, env];
  },

  visit_binary(tree: BinaryNode, env: TypeEnv): [Type, TypeEnv] {
    let [t1, e1] = typecheck(tree.lhs, env);
    let [t2, e2] = typecheck(tree.rhs, e1);
    if (t1 instanceof IntType && t2 instanceof IntType) {
      return [new IntType(), env];
    } else {
      throw "type error: binary operation on non-numbers";
    }
  },

  visit_quote(tree: QuoteNode, env: TypeEnv): [Type, TypeEnv] {
    // TK
  },

  visit_run(tree: RunNode, env: TypeEnv): [Type, TypeEnv] {
    let [t, e] = typecheck(tree.expr);
    if (t instanceof CodeType) {
      return [t.valtype, e];
    } else {
      throw "type error: running a non-code type";
    }
  },
}

function typecheck(tree: SyntaxNode, env: TypeEnv = {}): [Type, TypeEnv] {
  return ast_visit(Typecheck, tree, env);
}
