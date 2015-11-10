/// <reference path="ir.ts" />
/// <reference path="../visit.ts" />
/// <reference path="../util.ts" />

// The intermediate data structure for def/use analysis is a *stack of stack
// of maps*. The map assigns a defining node ID for names. We need a stack to
// reflect function scopes, and a stack of *those* to reflect quotes.
type NameMap = { [name: string]: number };
type NameStack = NameMap[][];

// Get the head of the head of a NameStack.
function ns_hd <T> (a: T[][]): T {
  return hd(hd(a));
}

// Like overlay, but works on the top-top of a NameStack.
function ns_overlay <T> (a: T[][]): T[][] {
  let ha = hd(a).slice(0);
  let hm = overlay(hd(ha));
  return cons(cons(hm, tl(ha)), tl(a));
}

// Create an overlay *function* scope in the top stack of a NameStack.
function ns_push_scope(ns: NameStack): NameStack {
  let top_stack = cons(<NameMap> {}, hd(ns));
  return cons(top_stack, tl(ns));
}

// Look up a value from any function scope in the top quote scope. Return the
// value and the indices (first in function scopes, then in quote scopes)
// where the value was found.
function ns_lookup (a: NameStack, key: string): [number, number, number] {
  for (let i = 0; i < a.length; ++i) {
    let [v, j] = stack_lookup(hd(a), key);
    if (v !== undefined) {
      return [v, j, i];
    }
  }
  return [undefined, undefined, undefined];
}

// The def/use analysis case for uses: both lookup and assignment nodes work
// the same way.
function handle_use(tree: LookupNode | AssignNode,
    [[ns, externs], table]: [[NameStack, NameMap], DefUseTable]):
    [[NameStack, NameMap], DefUseTable]
{
  // Try an ordinary variable lookup.
  let [def_id, fun_index, quote_index] = ns_lookup(ns, tree.ident);
  if (def_id === undefined) {
    // Try an extern.
    def_id = externs[tree.ident];
    if (def_id  === undefined) {
      throw "error: variable " + tree.ident + " not in name map";
    }
  }

  // The variable is bound (as opposed to free) if it is found in the
  // topmost function scope.
  let bound = (fun_index === 0);

  let t = table.slice(0);
  t[tree.id] = [def_id, bound, quote_index];
  return [[ns, externs], t];
}

// Here's the core def/use analysis. It threads through the ordinary NameStack
// and a special NameMap for externs.
type FindDefUse = ASTFold<[[NameStack, NameMap], DefUseTable]>;
function gen_find_def_use(fself: FindDefUse): FindDefUse {
  let fold_rules = ast_fold_rules(fself);
  let rules = compose_visit(fold_rules, {
    // The "let" case defines a variable in a map to refer to the "let" node.
    visit_let(tree: LetNode,
      [[ns, externs], table]: [[NameStack, NameMap], DefUseTable]):
      [[NameStack, NameMap], DefUseTable]
    {
      let [[n1, e1], t1] = fself(tree.expr, [[ns, externs], table]);
      let n2 = ns_overlay(n1);
      ns_hd(n2)[tree.ident] = tree.id;
      return [[n2, e1], t1];
    },

    // Similarly, "fun" defines variables in the map for its parameters.
    visit_fun(tree: FunNode,
      [[ns, externs], table]: [[NameStack, NameMap], DefUseTable]):
      [[NameStack, NameMap], DefUseTable]
    {
      // Update the top map with the function parameters.
      let n = ns_push_scope(ns);
      for (let param of tree.params) {
        ns_hd(n)[param.name] = param.id;
      }

      // Traverse the body with this new map.
      let [[n2, e2], t2] = fself(tree.body, [[n, externs], table]);
      // Then continue outside of the `fun` with the old maps.
      return [[ns, externs], t2];
    },

    // Lookup (i.e., a use) populates the def/use table based on the name map.
    visit_lookup(tree: LookupNode,
      [[ns, externs], table]: [[NameStack, NameMap], DefUseTable]):
      [[NameStack, NameMap], DefUseTable]
    {
      return handle_use(tree, [[ns, externs], table]);
    },

    // A mutation is another kind of use.
    visit_assign(tree: AssignNode,
      [[ns, externs], table]: [[NameStack, NameMap], DefUseTable]):
      [[NameStack, NameMap], DefUseTable]
    {
      // Recurse into the RHS expression.
      let [[n, e], t] = fself(tree.expr, [[ns, externs], table]);

      // Record the use.
      return handle_use(tree, [[n, e], t]);
    },

    // On quote, push an empty name map stack.
    visit_quote(tree: QuoteNode,
      [[ns, externs], table]: [[NameStack, NameMap], DefUseTable]):
      [[NameStack, NameMap], DefUseTable]
    {
      // Traverse inside the quote using a new, empty name map stack.
      let n = cons([<NameMap> {}], ns);
      let [_, t] = fold_rules.visit_quote(tree, [[n, externs], table]);
      // Then throw away the name map stack but preserve the updated table.
      return [[ns, externs], t];
    },

    // And pop on escape.
    visit_escape(tree: EscapeNode,
      [[ns, externs], table]: [[NameStack, NameMap], DefUseTable]):
      [[NameStack, NameMap], DefUseTable]
    {
      // Temporarily pop the current quote's scope.
      let n = tl(ns);
      // TODO Technically, we should probably do something to "pop" the
      // externs here so that externs declared in a quote aren't visible in an
      // escape. But the type system should take care of this for us, and
      // there can really only be one extern per name!
      let [_, t] = fold_rules.visit_escape(tree, [[n, externs], table]);
      // Then restore the old scope and return the updated table.
      return [[ns, externs], t];
    },

    // Insert extern definitions.
    visit_extern(tree: ExternNode,
      [[ns, externs], table]: [[NameStack, NameMap], DefUseTable]):
      [[NameStack, NameMap], DefUseTable]
    {
      let e = overlay(externs);
      e[tree.name] = tree.id;
      return [[ns, e], table];
    },
  });

  return function (tree: SyntaxNode,
    [[ns, externs], table]: [[NameStack, NameMap], DefUseTable]):
    [[NameStack, NameMap], DefUseTable]
  {
    return ast_visit(rules, tree, [[ns, externs], table]);
  };
};

// Build a def/use table for lookups that links them to their corresponding
// "let" or "fun" AST nodes.
// You can provide an initial NameMap of externs (for implementing
// intrinsics).
let _find_def_use = fix(gen_find_def_use);
function find_def_use(tree: SyntaxNode, externs: NameMap): DefUseTable {
  let [_, t] = _find_def_use(tree, [[[[{}]], externs], []]);
  return t;
}
