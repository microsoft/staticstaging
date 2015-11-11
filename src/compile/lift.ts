/// <reference path="ir.ts" />
/// <reference path="scope.ts" />
/// <reference path="../visit.ts" />

// A simple, imperative walk that indexes *all* the syntax nodes in a tree by
// their ID. We use this to build Procs and Progs by looking up the
// corresponding quote, function, and escape nodes.
type IndexTree = ASTFold<void>;
function gen_index_tree(table: SyntaxNode[]): Gen<IndexTree> {
  return function(fself: IndexTree): IndexTree {
    let fold_rules = ast_fold_rules(fself);
    let rules = compose_visit(fold_rules, {
      visit_fun(tree: FunNode, p: void): void
      {
        // Visit the parameters (not expressions).
        for (let param of tree.params) {
          table[param.id] = param;
        }
        return fold_rules.visit_fun(tree, null);
      },
    });

    return function (tree: SyntaxNode, p: void): void
    {
      table[tree.id] = tree;
      return ast_visit(rules, tree, null);
    };
  };
}
function index_tree(tree: SyntaxNode): SyntaxNode[] {
  let table: ExpressionNode[] = [];
  let _index_tree = fix(gen_index_tree(table));
  _index_tree(tree, null);
  return table;
}

function _is_quote(tree: SyntaxNode): tree is QuoteNode {
  return tree.tag === "quote";
}

function _is_fun(tree: SyntaxNode): tree is FunNode {
  return tree.tag === "fun";
}

function _is_escape(tree: SyntaxNode): tree is EscapeNode {
  return tree.tag === "escape";
}

// Construct mostly-empty Procs and Progs from an indexed tree. Return:
// - the function table (Procs)
// - the main Proc
// - the program table (Progs)
// - a combined table containing both Procs and Progs
function skeleton_scopes(tree: SyntaxNode, containers: number[],
  index: SyntaxNode[]):
  [Proc[], Proc, Prog[], Scope[]]
{
  let procs: Proc[] = [];
  let progs: Prog[] = [];
  let scopes: Scope[] = [];
  for (let node of index) {
    if (node !== undefined) {
      if (_is_quote(node) || _is_fun(node)) {
        // Common data for any scope.
        let parent = containers[node.id];
        let scope: Scope = {
          id: node.id,
          body: _is_quote(node) ? node.expr : (node as FunNode).body,

          free: [],
          bound: [],
          persist: [],
          splice: [],

          parent: parent,
          children: [],
          quote_parent: _nearest_quote(containers, progs, parent),
          quote_children: [],
        };

        // Quote (Prog) specifics.
        if (_is_quote(node)) {
          let prog: Prog = assign(scope, {
            annotation: node.annotation,
          });
          progs[node.id] = prog;
          scopes[node.id] = prog;

        // Function (Proc) specifics.
        } else if (_is_fun(node)) {
          // In Python, [p.id for p in params].
          let param_ids: number[] = [];
          for (let param of node.params) {
            param_ids.push(param.id);
          }

          let proc: Proc = assign(scope, {
            params: param_ids,
          });
          procs[node.id] = proc;
          scopes[node.id] = proc;
        }
      }
    }
  }

  // And an empty "main" proc for the top-level scope.
  let main: Proc = {
    id: null,
    body: tree,
    params: [],

    free: [],
    bound: [],
    persist: [],
    splice: [],

    parent: null,
    children: [],
    quote_parent: null,
    quote_children: [],
  };

  return [procs, main, progs, scopes];
}

// Find the nearest containing scope that's in `progs`.
// TODO just use `scopes` and `.parent`
function _nearest_quote(containers: number[], progs: Prog[],
    where: number): number {
  if (where === null) {
    return null;
  } else if (progs[where] !== undefined) {
    return where;
  } else {
    return _nearest_quote(containers, progs, containers[where]);
  }
}

// Assign children of the skeletal scopes.
function assign_children(scopes: Scope[], main: Proc, progs: Prog[],
    containers: number[])
{
  // Attribute each scope as a child of its parent.
  for (let scope of scopes) {
    if (scope !== undefined) {
      // Nearest scope of either kind.
      let parent_scope = scope.parent === null ? main :
        scopes[scope.parent];
      parent_scope.children.push(scope.id);

      // Nearest quote.
      let parent_quote = scope.quote_parent === null ? main :
        progs[scope.quote_parent];
      parent_quote.quote_children.push(scope.id);
    }
  }
}

// Attribute variables definitions and uses to scopes' bound and free
// variables, respectively.
function attribute_vars(scopes: Scope[], main: Proc, containers: number[],
    defuse: DefUseTable)
{
  for (let use_id in defuse) {
    let def_id = defuse[use_id];

    // Get the defining scope, or ignore if it's an intrinsic.
    let def_scope_id = containers[def_id];
    if (def_scope_id === undefined) {
      continue;
    }

    // Attribute to defining scope as bound variable.
    let def_scope = def_scope_id === null ? main : scopes[def_scope_id];
    def_scope.bound = set_add(def_scope.bound, def_id);

    // Walk the scopes upward from the use location. We are *free* in every
    // scope until our defining scope.
    let cur_scope = containers[use_id];
    while (cur_scope != def_scope_id && cur_scope != null) {
      scopes[cur_scope].free.push(def_id);

      // Move up by one scope.
      cur_scope = containers[cur_scope];
    }
  }
}

// Finally, attribute every escape to its containing quote and every function
// in between.
function attribute_escs(scopes: Scope[], progs: Prog[], containers: number[],
    index: SyntaxNode[])
{
  for (let node of index) {
    if (node !== undefined) {
      if (_is_escape(node)) {
        let esc: ProgEscape = {
          id: node.id,
          body: node.expr,
        };

        // Get the nearest quote ID. This is either the direct parent or its
        // containing quote.
        let quote_id: number;
        let closest_scope = containers[node.id];
        if (progs[closest_scope]) {
          quote_id = closest_scope;
        } else {
          quote_id = scopes[closest_scope].quote_parent;
        }

        // Iterate through all the scopes from here to the relevant next
        // quote. This makes all the intervening functions inside the quote
        // aware that there's an escape in their body, which can work like a
        // free variable.
        for (let cur_scope = containers[node.id];
             cur_scope !== containers[quote_id];
             cur_scope = containers[cur_scope])
        {
          if (node.kind === "persist") {
            scopes[cur_scope].persist.push(esc);
          } else if (node.kind === "splice") {
            scopes[cur_scope].splice.push(esc);
          } else {
            throw "error: unknown escape kind";
          }
        }
      }
    }
  }
}

function lift(tree: SyntaxNode, defuse: DefUseTable): [Proc[], Proc, Prog[]] {
  // Some bookkeeping to get started.
  let containers = find_scopes(tree);
  let index = index_tree(tree);

  // Construct "empty" Proc and Prog nodes.
  let [procs, main, progs, scopes] = skeleton_scopes(tree, containers, index);

  // Fill in children.
  assign_children(scopes, main, progs, containers);

  // Fill in free and bound variables.
  attribute_vars(scopes, main, containers, defuse);

  // Fill in the escapes (`persist` and `splice`).
  attribute_escs(scopes, progs, containers, index);

  return [procs, main, progs];
}
