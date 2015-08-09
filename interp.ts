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


// Tag-based dispatch to the interpreter rules. A somewhat messy alternative
// to constructing the AST in a type-safe way, but it'll do.
function interp(tree: SyntaxNode, env): [Value, Env] {
  switch (tree.tag) {
    case "literal":
      return interp_literal(<LiteralNode> tree, env);
    case "seq":
      return interp_seq(<SeqNode> tree, env);

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
