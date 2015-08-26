/// <reference path="ast.ts" />
/// <reference path="visit.ts" />

// Dynamic syntax.

type Value = number | Code;

interface Env {
  [key: string]: Value;
}

class Code {
  constructor(public expr: ExpressionNode) {}
}


// Dynamic semantics rules.

let Interp : ASTVisit<Env, [Value, Env]> = {
  visit_literal(tree: LiteralNode, env: Env): [Value, Env] {
    return [tree.value, env];
  },

  visit_seq(tree: SeqNode, env: Env): [Value, Env] {
    let [v, e] = interp(tree.lhs, env);
    return interp(tree.rhs, e);
  },

  visit_let(tree: LetNode, env: Env): [Value, Env] {
    let [v, e] = interp(tree.expr, env);
    // Abuse prototypes to create an overlay environment.
    let e2 = <Env> Object(e);
    e2[tree.ident] = v;
    return [v, e2];
  },

  visit_lookup(tree: LookupNode, env: Env): [Value, Env] {
    let v = env[tree.ident];
    if (v === undefined) {
      throw "error: undefined variable " + tree.ident;
    }
    return [v, env];
  },

  visit_quote(tree: RunNode, env: Env): [Value, Env] {
    return [new Code(tree.expr), env];
  },

  visit_escape(tree: EscapeNode, env: Env): [Value, Env] {
    throw "unimplemented";
  },

  visit_run(tree: RunNode, env: Env): [Value, Env] {
    let [v, e] = interp(tree.expr, env);
    if (v instanceof Code) {
      // Fresh environment for now.
      let res = interpret(v.expr);
      return [res, env];
    } else {
      throw "error: tried to run non-code value";
    }
  },

  visit_binary(tree: BinaryNode, env: Env): [Value, Env] {
    let [v1, e1] = interp(tree.lhs, env);
    let [v2, e2] = interp(tree.rhs, e1);
    if (typeof v1 === 'number' && typeof v2 === 'number') {
      let v: Value;
      switch (tree.op) {
        case "+":
          v = v1 + v2; break;
        case "-":
          v = v1 - v2; break;
        case "*":
          v = v1 * v2; break;
        case "/":
          v = v1 / v2; break;
        default:
          throw "error: unknown binary operator " + tree.op;
      }
      return [v, e2];
    } else {
      throw "error: non-numeric operands to operator";
    }
  }
}

function interp(tree: SyntaxNode, env: Env): [Value, Env] {
  return ast_visit(Interp, tree, env);
}

// Another visitor for scanning over a quoted tree. Returns the tree
// unchanged, except when it reaches an escape.
// TODO Make a RecursiveASTVisit that encapsulates the walking?
let QuoteInterp : ASTVisit<Env, [SyntaxNode, Env]> = {
  visit_literal(tree: LiteralNode, env: Env): [SyntaxNode, Env] {
    return [tree, env];
  },

  visit_seq(tree: SeqNode, env: Env): [SyntaxNode, Env] {
    let [t1, e1] = quote_interp(tree.lhs, env);
    let [t2, e2] = quote_interp(tree.rhs, e1);
    let out : SeqNode = {tag: "seq", lhs: t1, rhs: t2};
    return [out, e2];
  },

  visit_let(tree: LetNode, env: Env): [SyntaxNode, Env] {
    let [t, e] = quote_interp(tree.expr, env);
    let out : LetNode = {tag: "let", ident: tree.ident, expr: t};
    return [out, e];
  },

  visit_lookup(tree: LookupNode, env: Env): [SyntaxNode, Env] {
    return [tree, env];
  },

  visit_quote(tree: RunNode, env: Env): [SyntaxNode, Env] {
    // TODO
    return [tree, env];
  },

  visit_escape(tree: EscapeNode, env: Env): [SyntaxNode, Env] {
    let [v, e] = interp(tree, env);
    if (typeof v === "code") {
      return [v.expr, e];
    } else {
      throw "error: escape produced non-code value " + v;
    }
  },

  visit_run(tree: RunNode, env: Env): [SyntaxNode, Env] {
    let [t, e] = quote_interp(tree.expr, env);
    let out : RunNode = {tag: "run", expr: t};
    return [out, e];
  },

  visit_binary(tree: BinaryNode, env: Env): [SyntaxNode, Env] {
    let [t1, e1] = quote_interp(tree.lhs, env);
    let [t2, e2] = quote_interp(tree.rhs, e1);
    let out : BinaryNode = {tag: "binary", op: tree.op, lhs: t1, rhs: t2};
    return [out, e2];
  }
}

function quote_interp(tree: SyntaxNode, env: Env): [SyntaxNode, Env] {
  return ast_visit(QuoteInterp, tree, env);
}

// Helper to execute to a value in an empty initial environment.
function interpret(program: SyntaxNode): Value {
  let [v, e] = interp(program, {});
  return v;
}
