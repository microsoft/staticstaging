// Types for AST nodes.

interface SyntaxNode {
  tag: string;
}

interface ExpressionNode extends SyntaxNode {
}

interface LiteralNode extends ExpressionNode {
  value: number;
}

interface SeqNode extends ExpressionNode {
  lhs: ExpressionNode;
  rhs: ExpressionNode;
}

interface LetNode extends ExpressionNode {
  ident: string;
  expr: ExpressionNode;
}

interface LookupNode extends ExpressionNode {
  ident: string;
}

interface BinaryNode extends ExpressionNode {
  op: string;
  lhs: ExpressionNode;
  rhs: ExpressionNode;
}

interface QuoteNode extends ExpressionNode {
  expr: ExpressionNode;
}

interface RunNode extends ExpressionNode {
  expr: ExpressionNode;
}


// Dynamic syntax.

type Value = number;

interface Env {
  [key: string]: Value;
}


// Dynamic semantics rules.

function interp_literal(tree: LiteralNode, env: Env): [Value, Env] {
  return [tree.value, env];
}

function interp_seq(tree: SeqNode, env: Env): [Value, Env] {
  let [v, e] = interp(tree.lhs, env);
  return interp(tree.rhs, e);
}

function interp_let(tree: LetNode, env: Env): [Value, Env] {
  let [v, e] = interp(tree.expr, env);
  // Abuse prototypes to create an overlay environment.
  let e2 = <Env> Object(e);
  e2[tree.ident] = v;
  return [v, e2];
}

function interp_lookup(tree: LookupNode, env: Env): [Value, Env] {
  let v = env[tree.ident];
  if (v === undefined) {
    console.log("error: undefined variable " + tree.ident);
  }
  return [v, env];
}

function interp_quote(tree: RunNode, env: Env): [Value, Env] {
  // TODO
  return [-1, env]
}

function interp_run(tree: RunNode, env: Env): [Value, Env] {
  // TODO
  return [-1, env]
}

function interp_binary(tree: BinaryNode, env: Env): [Value, Env] {
  let [v1, e1] = interp(tree.lhs, env);
  let [v2, e2] = interp(tree.rhs, e1);
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
}


// Tag-based dispatch to the interpreter rules. A somewhat messy alternative
// to constructing the AST in a type-safe way, but it'll do.
function interp(tree: SyntaxNode, env: Env): [Value, Env] {
  switch (tree.tag) {
    case "literal":
      return interp_literal(<LiteralNode> tree, env);
    case "seq":
      return interp_seq(<SeqNode> tree, env);
    case "let":
      return interp_let(<LetNode> tree, env);
    case "lookup":
      return interp_lookup(<LookupNode> tree, env);
    case "binary":
      return interp_binary(<BinaryNode> tree, env);
    case "quote":
      return interp_quote(<QuoteNode> tree, env);
    case "run":
      return interp_run(<RunNode> tree, env);

    default:
      console.log("error: unknown syntax node " + tree.tag);
      return;
  }
}

// Helper to execute to completion in an empty initial environment.
function interpret(program: SyntaxNode): Value {
  let [v, e] = interp(program, {});
  return v;
}
