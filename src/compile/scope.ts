/// <reference path="ir.ts" />
/// <reference path="../visit.ts" />
/// <reference path="../util.ts" />

type FindScopes = ASTFold<[Scope[], Scope[]]>;
function gen_find_scopes(fself: FindScopes): FindScopes {
  let fold_rules = ast_fold_rules(fself);
  let rules = compose_visit(fold_rules, {
    visit_quote(tree: QuoteNode,
      [frames, scopes]: [Scope[], Scope[]]):
      [Scope[], Scope[]]
    {
      let frame: Scope = { func: null, quote: tree.id };
      let [_, s] = fold_rules.visit_quote(tree, [cons(frame, frames), scopes]);
      return [frames, s];
    },

    visit_escape(tree: EscapeNode,
      [frames, scopes]: [Scope[], Scope[]]):
      [Scope[], Scope[]]
    {
      let [_, s] = fold_rules.visit_escape(tree, [tl(frames), scopes]);
      return [frames, s];
    },

    visit_fun(tree: FunNode,
      [frames, scopes]: [Scope[], Scope[]]):
      [Scope[], Scope[]]
    {
      let frame: Scope = { func: tree.id, quote: hd(frames).quote };
      let [_, s] = fold_rules.visit_fun(tree, [cons(frame, tl(frames)), scopes]);
      return [frames, s];
    },
  });

  return function (tree: SyntaxNode,
    [frames, scopes]: [Scope[], Scope[]]):
    [Scope[], Scope[]]
  {
    // Record the scope for every tree.
    let scopes_out = scopes.slice(0);
    scopes_out[tree.id] = hd(frames);
    return ast_visit(rules, tree, [frames, scopes_out]);
  };
}

let _find_scopes = fix(gen_find_scopes);
function find_scopes(tree: SyntaxNode): Scope[] {
  let [_, scopes] = _find_scopes(tree, [[{ func: null, quote: null }], []]);
  return scopes;
}
