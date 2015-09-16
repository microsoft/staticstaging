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
  kind: string;  // splice or persist
}

interface RunNode extends ExpressionNode {
  expr: ExpressionNode;
}

interface FunNode extends ExpressionNode {
  params: {name: string, type: string}[];
  body: ExpressionNode;
}

interface CallNode extends ExpressionNode {
  fun: ExpressionNode;
  args: ExpressionNode[];
}

// An AST node that is not allowed to appear in source; it replaces persistent
// escapes when they are evaluated. A `Persist` has an index into the value list
// (called a `Pers` in the interpreter) associated with the `Code` that it
// appears inside.
interface PersistNode extends ExpressionNode {
  index: number,
}
