/// <reference path="ast.ts" />

function pretty_literal(tree: LiteralNode): string {
  return tree.value.toString();
}

function pretty_seq(tree: SeqNode): string {
  return pretty(tree.lhs) + " ; " + pretty(tree.rhs);
}

function pretty_let(tree: LetNode): string {
  return "let " + tree.ident + " = " + pretty(tree.expr);
}

function pretty_lookup(tree: LookupNode): string {
  return tree.ident;
}

function pretty_binary(tree: BinaryNode): string {
  return pretty(tree.lhs) + " " + tree.op + " " + pretty(tree.rhs);
}

function pretty_quote(tree: QuoteNode): string {
  return "< " + pretty(tree.expr) + " >";
}

function pretty_run(tree: RunNode): string {
  return "!" + pretty(tree);
}

function pretty(tree: SyntaxNode): string {
  switch (tree.tag) {
    case "literal":
      return pretty_literal(<LiteralNode> tree);
    case "seq":
      return pretty_seq(<SeqNode> tree);
    case "let":
      return pretty_let(<LetNode> tree);
    case "lookup":
      return pretty_lookup(<LookupNode> tree);
    case "binary":
      return pretty_binary(<BinaryNode> tree);
    case "quote":
      return pretty_quote(<QuoteNode> tree);
    case "run":
      return pretty_run(<RunNode> tree);

    default:
      console.log("error: unknown syntax node " + tree.tag);
      return;
  }
}
