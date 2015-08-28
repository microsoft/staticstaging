/// <reference path="ast.ts" />

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

    default:
      throw "error: unknown syntax node " + tree.tag;
  }
}

// Create a copy of an object `obj`, optionally with its fields updated
// according to `values`.
function merge<T extends Object>(obj: T, values: Object = {}): T {
  let out = <T> {};
  for (let key in obj) {
    if (values.hasOwnProperty(key)) {
      (<any> out)[key] = (<any> values)[key];
    } else if (obj.hasOwnProperty(key)) {
      (<any> out)[key] = (<any> obj)[key];
    }
  }
  return out;
}

// A visitor that traverses the AST recursively (in preorder) and creates a
// copy of it. Override some of these functions to replace parts of the tree
// with new SyntaxNodes.
// TODO Opportunistically avoid copying identical expressions?
type ASTTranslate = ASTVisit<void, SyntaxNode>;
let ASTTranslator : ASTTranslate = {
  visit_literal(tree: LiteralNode, param: void): SyntaxNode {
    return merge(tree);
  },

  visit_seq(tree: SeqNode, param: void): SyntaxNode {
    return merge(tree, {
      lhs: ast_visit(this, tree.lhs, null),
      rhs: ast_visit(this, tree.rhs, null),
    });
  },

  visit_let(tree: LetNode, param: void): SyntaxNode {
    return merge(tree, {
      expr: ast_visit(this, tree.expr, null),
    });
  },

  visit_lookup(tree: LookupNode, param: void): SyntaxNode {
    return merge(tree);
  },

  visit_binary(tree: BinaryNode, param: void): SyntaxNode {
    return merge(tree, {
      lhs: ast_visit(this, tree.lhs, null),
      rhs: ast_visit(this, tree.rhs, null),
    });
  },

  visit_quote(tree: QuoteNode, param: void): SyntaxNode {
    return merge(tree, {
      expr: ast_visit(this, tree.expr, null),
    });
  },

  visit_escape(tree: EscapeNode, param: void): SyntaxNode {
    return merge(tree, {
      expr: ast_visit(this, tree.expr, null),
    });
  },

  visit_run(tree: RunNode, param: void): SyntaxNode {
    return merge(tree, {
      expr: ast_visit(this, tree.expr, null),
    });
  },
};
