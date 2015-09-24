/// <reference path="util.ts" />
/// <reference path="ast.ts" />
/// <reference path="type.ts" />

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
