/// <reference path="util.ts" />
/// <reference path="ast.ts" />
/// <reference path="type.ts" />
/// <reference path="visit.ts" />

// A visitor that traverses the AST recursively (in preorder) and creates a
// copy of it. Override some of these functions to replace parts of the tree
// with new SyntaxNodes.
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

  visit_fun(tree: FunNode, param: void): SyntaxNode {
    return merge(tree, {
      body: ast_visit(this, tree.body, null),
    });
  },

  visit_call(tree: CallNode, param: void): SyntaxNode {
    let arg_trees : SyntaxNode[] = [];
    for (let arg in tree.args) {
      let translated_arg = <SyntaxNode> ast_visit(this, arg, null);
      arg_trees.push(translated_arg);
    }
    return merge(tree, {
      fun: ast_visit(this, tree.fun, null),
      args: arg_trees,
    });
  },

  visit_persist(tree: PersistNode, param: void): SyntaxNode {
    return merge(tree);
  },
};

function is_lookup(tree: SyntaxNode): tree is LookupNode {
  return tree.tag === "lookup";
}

// Get a copy of the *elaborated* AST with syntactic sugar removed. For now,
// the only sugar is "auto-persists", i.e., references to variables from other
// stages.
function desugar(tree: SyntaxNode, type_map: TypeTable): SyntaxNode {
  if (is_lookup(tree)) {
    let [type, env] = type_map[tree.id];
    console.log(tree.ident);
    return tree;
  } else {
    return tree;
  }
}
