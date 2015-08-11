/// <reference path="ast.ts" />

class ASTVisitor<P, R> {
  visit(tree: SyntaxNode, param: P): R {
    switch (tree.tag) {
      case "literal":
        return this.visit_literal(<LiteralNode> tree, param);
      case "seq":
        return this.visit_seq(<SeqNode> tree, param);
      case "let":
        return this.visit_let(<LetNode> tree, param);
      case "lookup":
        return this.visit_lookup(<LookupNode> tree, param);
      case "binary":
        return this.visit_binary(<BinaryNode> tree, param);
      case "quote":
        return this.visit_quote(<QuoteNode> tree, param);
      case "run":
        return this.visit_run(<RunNode> tree, param);

      default:
        console.log("error: unknown syntax node " + tree.tag);
        return;
    }
  }

  // Wishing for abstract methods.
  visit_literal(tree: LiteralNode, param: P): R {
    throw "unimplemented";
  }
  visit_seq(tree: SeqNode, param: P): R {
    throw "unimplemented";
  }
  visit_let(tree: LetNode, param: P): R {
    throw "unimplemented";
  }
  visit_lookup(tree: LookupNode, param: P): R {
    throw "unimplemented";
  }
  visit_binary(tree: BinaryNode, param: P): R {
    throw "unimplemented";
  }
  visit_quote(tree: QuoteNode, param: P): R {
    throw "unimplemented";
  }
  visit_run(tree: RunNode, param: P): R {
    throw "unimplemented";
  }
}
