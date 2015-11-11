/// <reference path="ir.ts" />
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

// TODO This could be memoized/precomputed.
function _containing_quote(scopes: number[], progs: Prog[],
    where: number): number {
  if (where === null) {
    return null;
  } else if (progs[where] !== undefined) {
    return where;
  } else {
    return _containing_quote(scopes, progs, scopes[where]);
  }
}

function lift(tree: SyntaxNode, defuse: DefUseTable, scopes: number[],
    index: SyntaxNode[]): [Proc[], Proc, Prog[]] {
  // Construct "empty" Proc and Prog nodes.
  let procs: Proc[] = [];
  let progs: Prog[] = [];
  let all_scopes: Scope[] = [];
  for (let node of index) {
    if (node !== undefined) {
      if (_is_quote(node) || _is_fun(node)) {
        // Common data for any scope.
        let scope: Scope = {
          id: node.id,
          body: _is_quote(node) ? node.expr : (node as FunNode).body,

          free: [],
          bound: [],
          persist: [],
          splice: [],

          parent: scopes[node.id],
          children: [],
          quote_parent: _containing_quote(scopes, progs, node.id),
          quote_children: [],
        };

        // Quote (Prog) specifics.
        if (_is_quote(node)) {
          let prog: Prog = assign(scope, {
            annotation: node.annotation,
          });
          progs[node.id] = prog;
          all_scopes[node.id] = prog;

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
          all_scopes[node.id] = proc;
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

  // Attribute each scope as a child of its parent.
  for (let scope of all_scopes) {
    if (scope !== undefined) {
      // Nearest scope of either kind.
      let parent_scope = scope.parent === null ? main :
        all_scopes[scope.parent];
      parent_scope.children.push(scope.id);

      // Nearest quote.
      let parent_quote = scope.quote_parent === null ? main :
        progs[scope.quote_parent];
      parent_quote.quote_children.push(scope.id);
    }
  }

  // Next, attribute every *use* (lookup or assignment) as a free variable
  // where appropriate.
  // Attribute every *definition* as a bound variable in its containing scope.
  for (let use_id in defuse) {
    let def_id = defuse[use_id];

    // Attribute to defining scope as bound variable.
    let def_scope_id = scopes[def_id];
    let def_scope = def_scope_id === null ? main : all_scopes[def_scope_id];
    def_scope.bound = set_add(def_scope.bound, def_id);

    // Walk the scopes upward from the use location. We are *free* in every
    // scope until our defining scope.
    let cur_scope = scopes[use_id];
    while (cur_scope != def_scope_id && cur_scope != null) {
      all_scopes[cur_scope].free.push(def_id);

      // Move up by one scope.
      cur_scope = scopes[cur_scope];
    }
  }

  // Finally, attribute every escape to its containing quote and every
  // function in between.
  for (let node of index) {
    if (node !== undefined) {
      if (_is_escape(node)) {
        let esc: ProgEscape = {
          id: node.id,
          body: node.expr,
        };

        // Iterate through all the scopes from here to the relevant next
        // quote. This makes all the intervening functions inside the quote
        // aware that there's an escape in their body, which can work like a
        // free variable.
        let quote_id = all_scopes[scopes[node.id]].quote_parent;
        for (let cur_scope = scopes[node.id];
             cur_scope !== scopes[quote_id];
             cur_scope = scopes[cur_scope])
        {
          if (node.kind === "persist") {
            all_scopes[cur_scope].persist.push(esc);
          } else if (node.kind === "splice") {
            all_scopes[cur_scope].splice.push(esc);
          } else {
            throw "error: unknown escape kind";
          }
        }
      }
    }
  }

  return [procs, main, progs];
}
