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

interface ReferenceNode extends ExpressionNode {
  ident: string;
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

function interp_reference(tree: ReferenceNode, env: Env): [Value, Env] {
  return [env[tree.ident], env];
}


// Tag-based dispatch to the interpreter rules. A somewhat messy alternative
// to constructing the AST in a type-safe way, but it'll do.
function interp(tree: SyntaxNode, env): [Value, Env] {
  switch (tree.tag) {
    case "literal":
      return interp_literal(<LiteralNode> tree, env);
    case "seq":
      return interp_seq(<SeqNode> tree, env);
    case "let":
      return interp_let(<LetNode> tree, env);
    case "reference":
      return interp_reference(<ReferenceNode> tree, env);

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
