/// <reference path="ast.ts" />

// Dynamic syntax.

type Value = number | Code;

interface Env {
  [key: string]: Value;
}

class Code {
  constructor(public expr: ExpressionNode) {}
}


// Dynamic semantics rules.

class Interpret extends ASTVisitor<Env, [Value, Env]> {
  visit_literal(tree: LiteralNode, env: Env): [Value, Env] {
    return [tree.value, env];
  }

  visit_seq(tree: SeqNode, env: Env): [Value, Env] {
    let [v, e] = this.visit(tree.lhs, env);
    return this.visit(tree.rhs, e);
  }

  visit_let(tree: LetNode, env: Env): [Value, Env] {
    let [v, e] = this.visit(tree.expr, env);
    // Abuse prototypes to create an overlay environment.
    let e2 = <Env> Object(e);
    e2[tree.ident] = v;
    return [v, e2];
  }

  visit_lookup(tree: LookupNode, env: Env): [Value, Env] {
    let v = env[tree.ident];
    if (v === undefined) {
      console.log("error: undefined variable " + tree.ident);
    }
    return [v, env];
  }

  visit_quote(tree: RunNode, env: Env): [Value, Env] {
    return [new Code(tree.expr), env];
  }

  visit_run(tree: RunNode, env: Env): [Value, Env] {
    let [v, e] = this.visit(tree.expr, env);
    if (v instanceof Code) {
      // Fresh environment for now.
      let res = interpret(v.expr);
      return [res, env];
    } else {
      console.log("error: tried to run non-code value");
    }
  }

  visit_binary(tree: BinaryNode, env: Env): [Value, Env] {
    let [v1, e1] = this.visit(tree.lhs, env);
    let [v2, e2] = this.visit(tree.rhs, e1);
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
          console.log("error: unknown binary operator " + tree.op);
      }
      return [v, e2];
    } else {
      console.log("error: non-numeric operands to operator");
    }
  }
}


// Helper to execute to completion in an empty initial environment.
function interpret(program: SyntaxNode): Value {
  let [v, e] = new Interpret().visit(program, {});
  return v;
}
