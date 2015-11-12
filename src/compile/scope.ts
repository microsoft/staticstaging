/// <reference path="ir.ts" />
/// <reference path="../visit.ts" />
/// <reference path="../util.ts" />

module FindScopes {

// A ScopeFrame marks the containing quote and function IDs for any node.
// Either "coordinate" may be null if the tree is outside of a function (in
// its current quote) or is top-level, outside of any quote.
interface ScopeFrame {
  func: number,
  quote: number,
};

type FindScopesFun = ASTFold<[ScopeFrame[], number[]]>;
function gen_find_scopes(fself: FindScopesFun): FindScopesFun {
  let fold_rules = ast_fold_rules(fself);
  let rules = compose_visit(fold_rules, {
    visit_quote(tree: QuoteNode,
      [frames, scopes]: [ScopeFrame[], number[]]):
      [ScopeFrame[], number[]]
    {
      let frame: ScopeFrame = { func: null, quote: tree.id };
      let [_, s] = fold_rules.visit_quote(tree, [cons(frame, frames), scopes]);
      return [frames, s];
    },

    visit_escape(tree: EscapeNode,
      [frames, scopes]: [ScopeFrame[], number[]]):
      [ScopeFrame[], number[]]
    {
      let [_, s] = fold_rules.visit_escape(tree, [tl(frames), scopes]);
      return [frames, s];
    },

    visit_fun(tree: FunNode,
      [frames, scopes]: [ScopeFrame[], number[]]):
      [ScopeFrame[], number[]]
    {
      let frame: ScopeFrame = { func: tree.id, quote: hd(frames).quote };
      let [_, s] = fold_rules.visit_fun(tree,
          [cons(frame, tl(frames)), scopes]);

      // Also add the parameters, which don't get visited by normal recursion.
      let scopes_out = s.slice(0);
      for (let param of tree.params) {
        scopes_out[param.id] = tree.id;
      }

      return [frames, scopes_out];
    },
  });

  return function (tree: SyntaxNode,
    [frames, scopes]: [ScopeFrame[], number[]]):
    [ScopeFrame[], number[]]
  {
    // Record the scope for every tree.
    let frame = hd(frames);
    let scopes_out = scopes.slice(0);
    scopes_out[tree.id] = frame.func !== null ? frame.func : frame.quote;
    return ast_visit(rules, tree, [frames, scopes_out]);
  };
}

let _find_scopes = fix(gen_find_scopes);
export function find_scopes(tree: SyntaxNode): number[] {
  let [_, scopes] = _find_scopes(tree, [[{ func: null, quote: null }], []]);
  return scopes;
}

}
