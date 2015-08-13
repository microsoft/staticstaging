/// <reference path="ast.ts" />
/// <reference path="visit.ts" />

interface Type {
  tag: TypeTag,
  stage: number,
}

enum TypeTag {
  Int,
}

// These should probably be interned.
function mktype(tag: TypeTag, stage: number = 0): Type {
  return {
    tag: tag,
    stage: stage,
  };
}

function pretty_type(t: Type): string {
  return TypeTag[t.tag] + "@" + t.stage;
}

interface TypeEnv {
  [key: string]: Type;
}

// Adjust the stage of every type in an environment.
function stage_env(e: TypeEnv, amount: number = 1): TypeEnv {
  let e2 : TypeEnv = {};
  for (let key in e) {
    let t : Type = e[key];
    e2[key] = mktype(t.tag, t.stage + amount);
  }
  return e2;
}


// Type rules.

let Typecheck : ASTVisit<TypeEnv, [Type, TypeEnv]> = {
  visit_literal(tree: LiteralNode, env: TypeEnv): [Type, TypeEnv] {
    return [mktype(TypeTag.Int), env];
  },

  visit_seq(tree: SeqNode, env: TypeEnv): [Type, TypeEnv] {
    let [t, e] = check(tree.lhs, env);
    return check(tree.rhs, e);
  },

  visit_let(tree: LetNode, env: TypeEnv): [Type, TypeEnv] {
    let [t, e] = check(tree.expr, env);
    // Like the interpreter, we abuse prototypes to create an overlay
    // environment.
    let e2 = <TypeEnv> Object(e);
    e2[tree.ident] = t;
    return [t, e2];
  },

  visit_lookup(tree: LookupNode, env: TypeEnv): [Type, TypeEnv] {
    let t = env[tree.ident];
    if (t === undefined) {
      throw "type error: undefined variable " + tree.ident;
    }
    return [t, env];
  },

  visit_binary(tree: BinaryNode, env: TypeEnv): [Type, TypeEnv] {
    let [t1, e1] = check(tree.lhs, env);
    let [t2, e2] = check(tree.rhs, e1);
    if (t1.stage == 0 && t2.stage == 0) {
      if (t1.tag == TypeTag.Int && t2.tag == TypeTag.Int) {
        return [mktype(TypeTag.Int), env];
      } else {
        throw "type error: binary operation on non-numbers";
      }
    } else {
      throw "type error: binary operation on wrong stage";
    }
  },

  visit_quote(tree: QuoteNode, env: TypeEnv): [Type, TypeEnv] {
    // Move the current context "up" before checking inside the quote.
    let inner_env = stage_env(env, -1);
    let [t, e] = check(tree.expr, inner_env);
    // And move the result type back "down".
    return [mktype(t.tag, t.stage + 1), env];
  },

  visit_run(tree: RunNode, env: TypeEnv): [Type, TypeEnv] {
    let [t, e] = check(tree.expr, env);
    if (t.stage > 0) {
      return [mktype(t.tag, t.stage - 1), e];
    } else {
      throw "type error: running a non-code type";
    }
  },
}

function check(tree: SyntaxNode, env: TypeEnv): [Type, TypeEnv] {
  return ast_visit(Typecheck, tree, env);
}

function typecheck(tree: SyntaxNode): Type {
  let [t, e] = check(tree, {});
  return t;
}
