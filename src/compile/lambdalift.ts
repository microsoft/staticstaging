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

interface LambdaLiftFrame {
  free: number[],  // Free variable IDs in the current function.
  bound: number[],  // Bound variable IDs declared in the function.
  persists: number[],  // Persist IDs.
  csrs: number[],  // Cross-stage references IDs.
}

function lambda_lift_frame(id: number): LambdaLiftFrame {
  return {
    free: [],
    bound: [],
    persists: [],
    csrs: [],
  };
}

type LambdaLift = ASTFold<[LambdaLiftFrame[], Proc[]]>;
function gen_lambda_lift(defuse: DefUseTable, scopes: Scope[], externs: string[]):
  Gen<LambdaLift>
{
  return function (fself: LambdaLift): LambdaLift {
    let fold_rules = ast_fold_rules(fself);
    let rules = compose_visit(fold_rules, {
      // Collect the free variables and construct a Proc.
      visit_fun(tree: FunNode,
        [frames, procs]: [LambdaLiftFrame[], Proc[]]):
        [LambdaLiftFrame[], Proc[]]
      {
        // Accumulate the parameter IDs. They are considered bound variables
        // for the purpose of recursion into the body.
        let params: number[] = [];
        for (let param of tree.params) {
          params.push(param.id);
        }

        // Recursive call.
        let frame = hd(frames);
        let subframe: LambdaLiftFrame = {
          free: [],
          bound: params,
          persists: [],
          csrs: [],
        };
        let [frames2, procs2] = fold_rules.visit_fun(tree, [cons(subframe, tl(frames)), procs]);
        let frame2 = hd(frames2);

        // Insert the new Proc. Procs are indexed by the ID of the defining
        // `fun` node.
        let proc: Proc = {
          id: tree.id,
          body: tree.body,
          params: params,
          free: frame2.free,
          bound: set_diff(frame2.bound, params),  // Do not double-count params.
          persists: frame2.persists,
          csr: frame2.csrs,
        };
        let ret_procs = procs2.slice(0);
        ret_procs[tree.id] = proc;

        let ret_frame: LambdaLiftFrame = {
          bound: frame.bound,

          // Add our new free variables to the parent's free variables, except
          // for its bound variables.
          free: frame.free.concat(set_diff(frame2.free, frame.bound)),

          // Persists in this function are also persists in the containing
          // function.
          persists: frame2.persists.concat(frame.persists),

          // Same with cross-stage references.
          csrs: frame2.csrs.concat(frame.csrs),
        };
        return [cons(ret_frame, tl(frames2)), ret_procs];
      },

      // Add free variables to the free set.
      visit_lookup(tree: LookupNode,
        [frames, procs]: [LambdaLiftFrame[], Proc[]]):
        [LambdaLiftFrame[], Proc[]]
      {
        let frame = hd(frames);
        let f: number[] = frame.free;

        let defid = defuse[tree.id];
        let is_extern = externs[defid] !== undefined;
        if (!is_extern) {
          let is_bound = scopes[defid].func === scopes[tree.id].func;

          // Possibly add this to the free variables.
          if (!is_bound) {
            f = set_add(frame.free, defid);
          }
        }

        let ret_frame = assign(frame, { free: f });
        return [cons(ret_frame, tl(frames)), procs];
      },

      // Add bound variables to the bound set.
      visit_let(tree: LetNode,
        [frames, procs]: [LambdaLiftFrame[], Proc[]]):
        [LambdaLiftFrame[], Proc[]]
      {
        let [frames2, procs2] = fold_rules.visit_let(tree, [frames, procs]);
        let frame = hd(frames2);
        let ret_frame = assign(frame, {
          bound: set_add(frame.bound, tree.id),
        });
        return [cons(ret_frame, tl(frames2)), procs2];
      },

      // Push a frame.
      visit_quote(tree: QuoteNode,
        [frames, procs]: [LambdaLiftFrame[], Proc[]]):
        [LambdaLiftFrame[], Proc[]]
      {
        let rec_frame = lambda_lift_frame(tree.id);
        let [frames2, procs2] = fself(tree.expr, [cons(rec_frame, frames), procs]);
        return [tl(frames2), procs2];
      },

      // Pop a frame.
      visit_escape(tree: EscapeNode,
        [frames, procs]: [LambdaLiftFrame[], Proc[]]):
        [LambdaLiftFrame[], Proc[]]
      {
        let frame = hd(frames);
        let [frames2, procs2] = fself(tree.expr, [tl(frames), procs]);

        // Add persist escapes to the top scope.
        let ret_persists: number[];
        if (tree.kind === "persist") {
          ret_persists = frame.persists.concat(tree.id);
        } else {
          ret_persists = frame.persists;
        }

        let ret_frame = assign(frame, { persists: ret_persists });
        return [cons(ret_frame, frames2), procs2];
      },
    });

    return function (tree: SyntaxNode,
      [frames, procs]: [LambdaLiftFrame[], Proc[]]):
      [LambdaLiftFrame[], Proc[]]
    {
      return ast_visit(rules, tree, [frames, procs]);
    }
  }
}

// A wrapper for lambda lifting also includes the "main" function as a Proc
// with no free variables.
function lambda_lift(tree: SyntaxNode, table: DefUseTable, scopes: Scope[], externs: string[]):
  [Proc[], Proc]
{
  let _lambda_lift = fix(gen_lambda_lift(table, scopes, externs));
  let [frames, procs] = _lambda_lift(tree, [[lambda_lift_frame(null)], []]);
  let main: Proc = {
    id: null,
    body: tree,
    params: [],
    free: [],
    bound: hd(frames).bound,
    persists: [],
    csr: [],
  };
  return [procs, main];
}

