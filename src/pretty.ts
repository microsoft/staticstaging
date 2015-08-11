/// <reference path="ast.ts" />
/// <reference path="visitor.ts" />

class Pretty extends ASTVisitor<void, string> {
  visit_literal(tree: LiteralNode, _: void): string {
    return tree.value.toString();
  }

  visit_seq(tree: SeqNode, _: void): string {
    return this.visit(tree.lhs) + " ; " + this.visit(tree.rhs);
  }

  visit_let(tree: LetNode, _: void): string {
    return "let " + tree.ident + " = " + this.visit(tree.expr);
  }

  visit_lookup(tree: LookupNode, _: void): string {
    return tree.ident;
  }

  visit_binary(tree: BinaryNode, _: void): string {
    return this.visit(tree.lhs) + " " + tree.op + " " + this.visit(tree.rhs);
  }

  visit_quote(tree: QuoteNode, _: void): string {
    return "< " + this.visit(tree.expr) + " >";
  }

  visit_run(tree: RunNode, _: void): string {
    return "!" + this.visit(tree);
  }
}

function pretty(tree: SyntaxNode): string {
  return new Pretty().visit(tree, null);
}
