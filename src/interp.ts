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
    let e2 = <Env> Object.create(e);
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
    // Jump to any escapes and execute them.
    let [t, e] = quote_interp(tree.expr, env);
    // Wrap the resulting AST as a code value.
    return [new Code(t), e];
  },

  visit_escape(tree: EscapeNode, env: Env): [Value, Env] {
    throw "error: top-level escape";
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
// TODO Using closure state instead of parameters is very ugly.
function quote_interp(tree: SyntaxNode, env: Env): [SyntaxNode, Env] {
  // We start out at level 1: inside a top-level quote.
  let level = 1;  // TODO

  // Sadly, the TypeScript type system does not yet know how to combine a
  // prototype overridden fields. So we're on our own.
  let QuoteInterp = <ASTTranslate> Object.create(ASTTranslator);

  // A quote increments the level.
  QuoteInterp.visit_quote = function (tree: RunNode, param: void): SyntaxNode {
    level += 1;  // TODO
    // Defer to the default ASTTranslator implementation.
    return ASTTranslator.visit_quote.call(this, tree);
  };

  // An escape decrements the level or, if we're already at level 1,
  // switches back to eager interpretation.
  QuoteInterp.visit_escape = function(tree: EscapeNode, param: void): SyntaxNode {
    level -= 1;  // TODO
    if (level == 0) {
      // Escaped back out of the top-level quote! Evaluate and splice.
      let [v, e] = interp(tree.expr, env);
      if (v instanceof Code) {
        env = e;  // TODO
        return v.expr;
      } else {
        throw "error: escape produced non-code value " + v;
      }
    } else {
      // Keep going.
      ASTTranslator.visit_escape.call(this, tree);
    }
  };

  return [ast_visit(QuoteInterp, tree, null), env];
}

// Helper to execute to a value in an empty initial environment.
function interpret(program: SyntaxNode): Value {
  let [v, e] = interp(program, {});
  return v;
}
