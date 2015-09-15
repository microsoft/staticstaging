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

interface EscapeNode extends ExpressionNode {
  expr: ExpressionNode;
}

interface RunNode extends ExpressionNode {
  expr: ExpressionNode;
}

interface FunNode extends ExpressionNode {
  params: {name: string, type: string}[];
  body: ExpressionNode;
}
