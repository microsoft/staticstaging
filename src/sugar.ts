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
      for (let arg of tree.args) {
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

// Another type test for the specific kind of node we're interested in. We'll
// use this to follow one piece of advice from the "Scrap Your Boilerplate"
// paper: when you're interested in one kind of node, first write a function
// that dynamically tests for that kind and does its action. Then use separate
// code to lift it to a recursive traversal.
function is_lookup(tree: SyntaxNode): tree is LookupNode {
  return tree.tag === "lookup";
}

// An inheritance layer on ASTTranslate that desugars auto-persists. This
// *updates* the type_table with information about any newly generated nodes.
function gen_desugar(type_table: TypeTable): Gen<ASTTranslate> {
  return function (fsuper: ASTTranslate): ASTTranslate {
    return function (tree: SyntaxNode): SyntaxNode {
      if (is_lookup(tree)) {
        let [type, env] = type_table[tree.id];
        let [_, index] = type_lookup(env, tree.ident);

        if (index === 0) {
          // A variable from the current stage. This is a normal access.
          return fsuper(tree);
        } else {
          // A variable from any other stage is an auto-persist. Construct a
          // nested set of explicit persist escapes.
          let lookup : LookupNode = { tag: "lookup", ident: tree.ident };
          let escape : EscapeNode;
          let new_tree : ExpressionNode = lookup;
          for (let i = 0; i < index; ++i) {
            escape = { tag: "escape", kind: "persist", expr: new_tree };
            new_tree = escape;
          }

          // Now we elaborate the subtree to preserve the restrictions of the
          // IR.
          let elaborated = elaborate_subtree(new_tree, env, type_table);

          return elaborated;
        }
      } else {
        return fsuper(tree);
      }
    }
  }
}

// Get a copy of the *elaborated* AST with syntactic sugar removed. For now,
// the only sugar is "auto-persists", i.e., references to variables from other
// stages.
function desugar(tree: SyntaxNode, type_table: TypeTable): SyntaxNode {
  let _desugar = fix(compose(gen_desugar(type_table), gen_translate));
  return _desugar(tree);
}
