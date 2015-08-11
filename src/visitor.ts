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
  visit_literal(LiteralNode, P): R {
    throw "unimplemented";
  }
  visit_seq(SeqNode, P): R {
    throw "unimplemented";
  }
  visit_let(LetNode, P): R {
    throw "unimplemented";
  }
  visit_lookup(LookupNode, P): R {
    throw "unimplemented";
  }
  visit_binary(BinaryNode, P): R {
    throw "unimplemented";
  }
  visit_quote(QuoteNode, P): R {
    throw "unimplemented";
  }
  visit_run(RunNode, P): R {
    throw "unimplemented";
  }
}
