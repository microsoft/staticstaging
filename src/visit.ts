/// <reference path="ast.ts" />
/// <reference path="util.ts" />

// An interface that can handle each AST node type.
interface ASTVisit<P, R> {
  visit_literal(tree: LiteralNode, param: P): R;
  visit_seq(tree: SeqNode, param: P): R;
  visit_let(tree: LetNode, param: P): R;
  visit_lookup(tree: LookupNode, param: P): R;
  visit_binary(tree: BinaryNode, param: P): R;
  visit_quote(tree: QuoteNode, param: P): R;
  visit_escape(tree: EscapeNode, param: P): R;
  visit_run(tree: RunNode, param: P): R;
  visit_fun(tree: FunNode, param: P): R;
  visit_call(tree: CallNode, param: P): R;
  visit_persist(tree: PersistNode, param: P): R;
}

// Tag-based dispatch to the visit functions. A somewhat messy alternative
// to constructing the AST in a type-safe way, but it'll do.
function ast_visit<P, R>(visitor: ASTVisit<P, R>,
                         tree: SyntaxNode, param: P): R {
  switch (tree.tag) {
    case "literal":
      return visitor.visit_literal(<LiteralNode> tree, param);
    case "seq":
      return visitor.visit_seq(<SeqNode> tree, param);
    case "let":
      return visitor.visit_let(<LetNode> tree, param);
    case "lookup":
      return visitor.visit_lookup(<LookupNode> tree, param);
    case "binary":
      return visitor.visit_binary(<BinaryNode> tree, param);
    case "quote":
      return visitor.visit_quote(<QuoteNode> tree, param);
    case "escape":
      return visitor.visit_escape(<EscapeNode> tree, param);
    case "run":
      return visitor.visit_run(<RunNode> tree, param);
    case "fun":
      return visitor.visit_fun(<FunNode> tree, param);
    case "call":
      return visitor.visit_call(<CallNode> tree, param);
    case "persist":
      return visitor.visit_persist(<PersistNode> tree, param);

    default:
      throw "error: unknown syntax node " + tree.tag;
  }
}

// An interface that can handle *some* AST node types.
// It's a shame this has to be copied n' pasted.
interface PartialASTVisit<P, R> {
  visit_literal? (tree: LiteralNode, param: P): R;
  visit_seq? (tree: SeqNode, param: P): R;
  visit_let? (tree: LetNode, param: P): R;
  visit_lookup? (tree: LookupNode, param: P): R;
  visit_binary? (tree: BinaryNode, param: P): R;
  visit_quote? (tree: QuoteNode, param: P): R;
  visit_escape? (tree: EscapeNode, param: P): R;
  visit_run? (tree: RunNode, param: P): R;
  visit_fun? (tree: FunNode, param: P): R;
  visit_call? (tree: CallNode, param: P): R;
  visit_persist? (tree: PersistNode, param: P): R;
}

let AST_TYPES = ["literal", "seq", "let", "lookup", "binary", "quote",
                 "escape", "run", "fun", "call", "persist"];

// Use a fallback function for any unhandled cases in a PartialASTVisit. This
// is some messy run-time metaprogramming!
function complete_visit <P, R> (
  fallback: (_: SyntaxNode, p: P) => R,
  partial: PartialASTVisit<P, R>):
  ASTVisit<P, R>
{
  let total = < ASTVisit<P, R> > merge(partial);
  for (let kind of AST_TYPES) {
    let fun_name = 'visit_' + kind;
    if (!partial.hasOwnProperty(fun_name)) {
      (<any> total)[fun_name] = fallback;
    }
  }
  return total;
}

// Overlay a partial visitor on top of a complete visitor.
function compose_visit <P, R> (
  base: ASTVisit<P, R>,
  partial: PartialASTVisit<P, R>):
  ASTVisit<P, R>
{
  return merge(base, partial);
}
