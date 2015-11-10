/// <reference path="ir.ts" />
/// <reference path="../visit.ts" />
/// <reference path="../util.ts" />

// Core lambda lifting produces Procs for all the `fun` nodes in the program.
//
// An important detail in our lambda-lifting interface is that the original
// functions and calls are *left in the AST* instead of replaced with special
// closure-creation and closure-invocation operations (as you might expect).
// The Proc table on the side serves as *substitutes* for these nodes, so
// their contents (especially `fun` nodes) are irrelevant even though they
// still exist.
//
// The parameters are:
// - Accumulated free variables.
// - Accumulated bound variables.
// - A stack indicating the current quote ID.
// - A stack of sets of persist escape IDs for the current function. We treat
//   these similarly to free variables.
// - The output list of Procs.
type LambdaLift = ASTFold<[number[], number[], number[], number[][], Proc[]]>;
function gen_lambda_lift(defuse: DefUseTable, externs: string[]):
  Gen<LambdaLift>
{
  return function (fself: LambdaLift): LambdaLift {
    let fold_rules = ast_fold_rules(fself);
    let rules = compose_visit(fold_rules, {
      // Collect the free variables and construct a Proc.
      visit_fun(tree: FunNode,
        [free, bound, qid, escs, procs]: [number[], number[], number[], number[][], Proc[]]):
        [number[], number[], number[], number[][], Proc[]]
      {
        // Accumulate the parameter IDs. They are considered bound variables
        // for the purpose of recursion into the body.
        let params: number[] = [];
        for (let param of tree.params) {
          params.push(param.id);
        }

        let [f, b, _, e, p] = fold_rules.visit_fun(tree, [[], params, qid, cons([], tl(escs)), procs]);

        // Get the top quote ID, or null for the outermost stage.
        let q: number;
        if (qid.length > 0) {
          q = hd(qid);
        } else {
          q = null;
        }

        // Insert the new Proc. Procs are indexed by the ID of the defining
        // `fun` node.
        let proc: Proc = {
          id: tree.id,
          body: tree.body,
          params: params,
          free: f,
          bound: set_diff(b, params),  // Do not double-count params.
          quote: q,
          persists: hd(e),
          csr: [],
        };
        let p2 = p.slice(0);
        p2[tree.id] = proc;

        // Free variables in the child that are not bound here get passed back
        // up to the parent.
        let sub_free = set_diff(f, bound);
        let parent_free = free.concat(sub_free);

        // Similarly, persists in this function are also persists in the
        // containing function.
        let outer_escs = hd(e).concat(hd(escs));
        let parent_escs = cons(outer_escs, tl(escs));

        return [parent_free, bound, qid, parent_escs, p2];
      },

      // Add free variables to the free set.
      visit_lookup(tree: LookupNode,
        [free, bound, qid, escs, procs]: [number[], number[], number[], number[][], Proc[]]):
        [number[], number[], number[], number[][], Proc[]]
      {
        let [defid, is_bound, _] = defuse[tree.id];
        let is_extern = externs[defid] !== undefined;

        let f: number[];
        if (!is_bound && !is_extern) {
          f = set_add(free, defid);
        } else {
          f = free;
        }

        return [f, bound, qid, escs, procs];
      },

      // Add bound variables to the bound set.
      visit_let(tree: LetNode,
        [free, bound, qid, escs, procs]: [number[], number[], number[], number[][], Proc[]]):
        [number[], number[], number[], number[][], Proc[]]
      {
        let [f, b, _, e, p] = fold_rules.visit_let(tree, [free, bound, qid, escs, procs]);
        let b2 = set_add(b, tree.id);
        return [f, b2, qid, e, p];
      },

      // Push a quote ID and escapes.
      visit_quote(tree: QuoteNode,
        [free, bound, qid, escs, procs]: [number[], number[], number[], number[][], Proc[]]):
        [number[], number[], number[], number[][], Proc[]]
      {
        let q = cons(tree.id, qid);
        let e = cons([], escs);
        let [f, b, _, __, p] = fself(tree.expr, [free, bound, q, e, procs]);
        return [f, b, qid, escs, p];
      },

      // Pop a quote ID and escapes. If this is a persist escape, record it.
      visit_escape(tree: EscapeNode,
        [free, bound, qid, escs, procs]: [number[], number[], number[], number[][], Proc[]]):
        [number[], number[], number[], number[][], Proc[]]
      {
        let q = tl(qid);
        let e = tl(escs);
        let [f, b, _, __, p] = fself(tree.expr, [free, bound, q, e, procs]);

        // Add persist escapes to the top scope.
        let e2: number[][];
        if (tree.kind === "persist") {
          e2 = cons(hd(escs).concat(tree.id), tl(escs));
        } else {
          e2 = escs;
        }

        return [f, b, qid, e2, p];
      },
    });

    return function (tree: SyntaxNode,
      [free, bound, qid, escs, procs]: [number[], number[], number[], number[][], Proc[]]):
      [number[], number[], number[], number[][], Proc[]]
    {
      return ast_visit(rules, tree, [free, bound, qid, escs, procs]);
    }
  }
}

// A wrapper for lambda lifting also includes the "main" function as a Proc
// with no free variables.
function lambda_lift(tree: SyntaxNode, table: DefUseTable, externs: string[]):
  [Proc[], Proc]
{
  let _lambda_lift = fix(gen_lambda_lift(table, externs));
  let [_, bound, __, ___, procs] = _lambda_lift(tree, [[], [], [], [[]], []]);
  let main: Proc = {
    id: null,
    body: tree,
    params: [],
    free: [],
    bound: bound,
    quote: null,
    persists: [],
    csr: [],
  };
  return [procs, main];
}

