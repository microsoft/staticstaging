/// <reference path="util.ts" />
/// <reference path="ast.ts" />
/// <reference path="type.ts" />
/// <reference path="visit.ts" />

// A visitor that traverses the AST recursively (in preorder) and creates a
// copy of it. Override some of these functions to replace parts of the tree
// with new SyntaxNodes.
type ASTTranslate = (tree: SyntaxNode) => SyntaxNode;
function gen_translate(fself: ASTTranslate): ASTTranslate {
  let translate_rules : ASTVisit<void, SyntaxNode> = {
    visit_literal(tree: LiteralNode, param: void): SyntaxNode {
      return merge(tree);
    },

    visit_seq(tree: SeqNode, param: void): SyntaxNode {
      return merge(tree, {
        lhs: fself(tree.lhs),
        rhs: fself(tree.rhs),
      });
    },

    visit_let(tree: LetNode, param: void): SyntaxNode {
      return merge(tree, {
        expr: fself(tree.expr),
      });
    },

    visit_lookup(tree: LookupNode, param: void): SyntaxNode {
      return merge(tree);
    },

    visit_binary(tree: BinaryNode, param: void): SyntaxNode {
      return merge(tree, {
        lhs: fself(tree.lhs),
        rhs: fself(tree.rhs),
      });
    },

    visit_quote(tree: QuoteNode, param: void): SyntaxNode {
      return merge(tree, {
        expr: fself(tree.expr),
      });
    },

    visit_escape(tree: EscapeNode, param: void): SyntaxNode {
      return merge(tree, {
        expr: fself(tree.expr),
      });
    },

    visit_run(tree: RunNode, param: void): SyntaxNode {
      return merge(tree, {
        expr: fself(tree.expr),
      });
    },

    visit_fun(tree: FunNode, param: void): SyntaxNode {
      return merge(tree, {
        body: fself(tree.body),
      });
    },

    visit_call(tree: CallNode, param: void): SyntaxNode {
      let arg_trees : SyntaxNode[] = [];
      for (let arg in tree.args) {
        arg_trees.push(fself(arg));
      }
      return merge(tree, {
        fun: fself(tree.fun),
        args: arg_trees,
      });
    },

    visit_persist(tree: PersistNode, param: void): SyntaxNode {
      return merge(tree);
    },
  };

  return function(tree: SyntaxNode): SyntaxNode {
    return ast_visit(translate_rules, tree, null);
  };
}

function gen_desugar(type_table: TypeTable): Gen<ASTTranslate> {
  return function (fsuper: ASTTranslate): ASTTranslate {
    return function (tree: SyntaxNode): SyntaxNode {
      if (is_lookup(tree)) {
        let [type, env] = type_table[tree.id];
        // console.log(tree.ident);
        return tree;
      } else {
        return fsuper(tree);
      }
    }
  }
}

function is_lookup(tree: SyntaxNode): tree is LookupNode {
  return tree.tag === "lookup";
}

// Get a copy of the *elaborated* AST with syntactic sugar removed. For now,
// the only sugar is "auto-persists", i.e., references to variables from other
// stages.
function desugar(tree: SyntaxNode, type_table: TypeTable): SyntaxNode {
  let _desugar = fix(compose(gen_desugar(type_table), gen_translate));
  return _desugar(tree);
}
