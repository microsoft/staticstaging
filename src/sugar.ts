/// <reference path="util.ts" />
/// <reference path="ast.ts" />
/// <reference path="type_elaborate.ts" />
/// <reference path="visit.ts" />

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
function gen_desugar(type_table: TypeTable, check: Gen<TypeCheck>):
  Gen<ASTTranslate>
{
  return function (fsuper: ASTTranslate): ASTTranslate {
    return function (tree: SyntaxNode): SyntaxNode {
      if (is_lookup(tree)) {
        let [type, env] = type_table[tree.id];
        let [stack, , externs, ,] = env;
        if (tree.ident in externs) {
          // Extern accesses are not desugared.
          return fsuper(tree);
        }

        let [, index] = stack_lookup(stack, tree.ident);

        if (index === 0) {
          // A variable from the current stage. This is a normal access.
          return fsuper(tree);
        } else {
          // A variable from any other stage is an auto-persist. Construct a
          // persist escape that looks up `index` stages.
          let lookup : LookupNode = { tag: "lookup", ident: tree.ident };
          let escape : EscapeNode = {
            tag: "escape",
            kind: "persist",
            expr: lookup,
            count: index,
          };

          // Now we elaborate the subtree to preserve the restrictions of the
          // IR.
          let elaborated = elaborate_subtree(escape, env, type_table, check);

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
function desugar(tree: SyntaxNode, type_table: TypeTable,
    check: Gen<TypeCheck>): SyntaxNode
{
  let _desugar = fix(compose(gen_desugar(type_table, check), gen_translate));
  return _desugar(tree);
}
