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

interface Env {
  [key: string]: number;
}

function interpret_literal(tree: LiteralNode, env: Env) {
  return tree.value;
}

function interpret_seq(tree: SeqNode, env: Env) {
  interpret(tree.lhs, env);
  return interpret(tree.rhs, env);
}

// Dispatch based on tag. A somewhat messy alternative to constructing the AST
// in a type-safe way, but it'll do.
function interpret(tree: SyntaxNode, env: Env = {}): any {
  switch (tree.tag) {
    case "literal":
      return interpret_literal(<LiteralNode> tree, env);
    case "seq":
      return interpret_seq(<SeqNode> tree, env);

    default:
      console.log("error: unknown syntax node " + tree.tag);
      return;
  }
}
