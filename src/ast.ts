export interface SyntaxNode {
  tag: string;  // The node type.
  id?: number;  // Used in IRs to add computed information.
}

export interface ExpressionNode extends SyntaxNode {
}

export interface LiteralNode extends ExpressionNode {
  value: number;
  type: string;  // int or float
}

export interface SeqNode extends ExpressionNode {
  lhs: ExpressionNode;
  rhs: ExpressionNode;
}

export interface LetNode extends ExpressionNode {
  ident: string;
  expr: ExpressionNode;
}

export interface AssignNode extends ExpressionNode {
  ident: string;
  expr: ExpressionNode;
}

export interface LookupNode extends ExpressionNode {
  ident: string;
}

export interface UnaryNode extends ExpressionNode {
  op: string;
  expr: ExpressionNode;
}

export interface BinaryNode extends ExpressionNode {
  op: string;
  lhs: ExpressionNode;
  rhs: ExpressionNode;
}

export interface QuoteNode extends ExpressionNode {
  expr: ExpressionNode;
  annotation: string;
  snippet: boolean;
}

export type EscapeKind = "splice" | "persist" | "snippet";
export interface EscapeNode extends ExpressionNode {
  expr: ExpressionNode;
  kind: EscapeKind;
  count: number;
}

export interface RunNode extends ExpressionNode {
  expr: ExpressionNode;
}

export interface FunNode extends ExpressionNode {
  params: ParamNode[];
  body: ExpressionNode;
}

export interface ParamNode extends SyntaxNode {
  name: string;
  type: TypeNode;
}

export interface CallNode extends ExpressionNode {
  fun: ExpressionNode;
  args: ExpressionNode[];
}

export interface ExternNode extends ExpressionNode {
  name: string;
  type: TypeNode;
  expansion: string;  // Or null, if it should expand to the name itself.
}

export interface IfNode extends ExpressionNode {
  cond: ExpressionNode,
  truex: ExpressionNode,
  falsex: ExpressionNode,
}

export interface MacroNode extends ExpressionNode {
  ident: string;
  expr: ExpressionNode;
}

export interface MacroCallNode extends ExpressionNode {
  macro: string;
  args: ExpressionNode[];
}

export interface TypeNode extends SyntaxNode {
}

export interface PrimitiveTypeNode extends TypeNode {
  name: string;
}

export interface InstanceTypeNode extends TypeNode {
  name: string;
  arg: TypeNode;
}

export interface FunTypeNode extends TypeNode {
  params: TypeNode[];
  ret: TypeNode;
}

export interface CodeTypeNode extends TypeNode {
  inner: TypeNode;
  annotation: string;
}

// An AST node that is not allowed to appear in source; it replaces persistent
// escapes when they are evaluated. A `Persist` has an index into the value list
// (called a `Pers` in the interpreter) associated with the `Code` that it
// appears inside.
export interface PersistNode extends ExpressionNode {
  index: number,
}
