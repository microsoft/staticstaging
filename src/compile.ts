/// <reference path="ast.ts" />
/// <reference path="visit.ts" />
/// <reference path="util.ts" />
/// <reference path="type.ts" />

// The main output of def/use analysis: For every lookup and assignment node
// ID, a defining node ID and a flag indicating whether the variable is bound
// (vs. free).
type DefUseTable = [number, boolean][];

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
// value and the index (in *function* scopes) where the value was found.
function ns_lookup (a: NameStack, key: string): [number, number] {
  return stack_lookup(hd(a), key);
}

// The def/use analysis case for uses: both lookup and assignment nodes work
// the same way.
function handle_use(tree: LookupNode | AssignNode,
    [[ns, externs], table]: [[NameStack, NameMap], DefUseTable]):
    [[NameStack, NameMap], DefUseTable]
{
  // Try an ordinary variable lookup.
  let [def_id, scope_index] = ns_lookup(ns, tree.ident);
  if (def_id === undefined) {
    // Try an extern.
    def_id = externs[tree.ident];
    if (def_id  === undefined) {
      throw "error: variable " + tree.ident + " not in name map";
    }
  }

  // The variable is bound (as opposed to free) if it is found in the
  // topmost function scope.
  let bound = (scope_index === 0);

  let t = table.slice(0);
  t[tree.id] = [def_id, bound];
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

// A procedure is a lambda-lifted function. It includes the original body of
// the function and the IDs of the parameters and the closed-over free
// variables used in the function.
interface Proc {
  id: number,  // or null for the main proc
  body: ExpressionNode,
  params: number[],
  free: number[],
  bound: number[],
  quote: number,  // or null for outside any quote
};

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
// - The output list of Procs.
type LambdaLift = ASTFold<[number[], number[], number[], Proc[]]>;
function gen_lambda_lift(defuse: DefUseTable): Gen<LambdaLift> {
  return function (fself: LambdaLift): LambdaLift {
    let fold_rules = ast_fold_rules(fself);
    let rules = compose_visit(fold_rules, {
      // Collect the free variables and construct a Proc.
      visit_fun(tree: FunNode,
        [free, bound, qid, procs]: [number[], number[], number[], Proc[]]):
        [number[], number[], number[], Proc[]]
      {
        let [f, b, _, p] = fold_rules.visit_fun(tree, [free, [], qid, procs]);

        // Accumulate the parameter IDs.
        let param_ids: number[] = [];
        for (let param of tree.params) {
          param_ids.push(param.id);
        }

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
          params: param_ids,
          free: f,
          bound: b,
          quote: q,
        };
        let p2 = p.slice(0);
        p2[tree.id] = proc;

        return [free, bound, qid, p2];
      },

      // Add free variables to the free set.
      visit_lookup(tree: LookupNode,
        [free, bound, qid, procs]: [number[], number[], number[], Proc[]]):
        [number[], number[], number[], Proc[]]
      {
        let [defid, is_bound] = defuse[tree.id];

        let f: number[];
        if (!is_bound) {
          f = set_add(free, defid);
        } else {
          f = free;
        }

        return [f, bound, qid, procs];
      },

      // Add bound variables to the bound set.
      visit_let(tree: LetNode,
        [free, bound, qid, procs]: [number[], number[], number[], Proc[]]):
        [number[], number[], number[], Proc[]]
      {
        let [f, b, _, p] = fold_rules.visit_let(tree, [free, bound, qid, procs]);
        let b2 = set_add(b, tree.id);
        return [f, b2, qid, p];
      },

      // Push a quote ID.
      visit_quote(tree: QuoteNode,
        [free, bound, qid, procs]: [number[], number[], number[], Proc[]]):
        [number[], number[], number[], Proc[]]
      {
        let q = cons(tree.id, qid);
        let [f, b, _, p] = fself(tree.expr, [free, bound, q, procs]);
        return [f, b, qid, p];
      },

      // Pop a quote ID.
      visit_escape(tree: EscapeNode,
        [free, bound, qid, procs]: [number[], number[], number[], Proc[]]):
        [number[], number[], number[], Proc[]]
      {
        let q = tl(qid);
        let [f, b, _, p] = fself(tree.expr, [free, bound, q, procs]);
        return [f, b, qid, p];
      },
    });

    return function (tree: SyntaxNode,
      [free, bound, qid, procs]: [number[], number[], number[], Proc[]]):
      [number[], number[], number[], Proc[]]
    {
      return ast_visit(rules, tree, [free, bound, qid, procs]);
    }
  }
}

// A wrapper for lambda lifting also includes the "main" function as a Proc
// with no free variables.
function lambda_lift(tree: SyntaxNode, table: DefUseTable): [Proc[], Proc] {
  let _lambda_lift = fix(gen_lambda_lift(table));
  let [_, bound, __, procs] = _lambda_lift(tree, [[], [], [], []]);
  let main: Proc = {
    id: null,
    body: tree,
    params: [],
    free: [],
    bound: bound,
    quote: null,
  };
  return [procs, main];
}

// A Prog represents a quoted program. It's the quotation analogue of a Proc.
// Progs can have bound variables but not free variables.
interface Prog {
  id: number,
  body: ExpressionNode,
  annotation: string,
  bound: number[],

  // Plain lists of all the escapes in the program.
  persist: ProgEscape[],
  splice: ProgEscape[],

  // List of IDs of subprograms inside the program.
  subprograms: number[],
}

interface ProgEscape {
  id: number,
  body: ExpressionNode,
}

// Bookkeeping for the quote-lifting process. This struct holds all the
// details that need to be passed recursively through quote-lifting to
// construct Progs.
interface QuoteLiftFrame {
  bound: number[],  // List of local variable IDs.
  persists: ProgEscape[],  // Persist escapes in the quote.
  splices: ProgEscape[],  // Splice escapes.
  subprograms: number[],  // IDs of contained quotes.
};

function quote_lift_frame(): QuoteLiftFrame {
  return {
    bound: [],
    persists: [],
    splices: [],
    subprograms: [],
  };
}

// Quote lifting is like lambda lifting, but for quotes.
//
// As with lambda lifting, we don't actually change the AST, but the resulting
// Progs do *supplant* the in-AST quote nodes. The same is true of escape
// nodes, which are replaced by the `persist` and `splice` members of Prog.
//
// Call this pass on the entire program (it is insensitive to lambda lifting).
//
// To lift all the Progs, this threads through two stacks of lists: one for
// bound variables (by id), and one for escape nodes.
type QuoteLift = ASTFold<[QuoteLiftFrame[], Prog[]]>;
function gen_quote_lift(fself: QuoteLift): QuoteLift {
  let fold_rules = ast_fold_rules(fself);
  let rules = compose_visit(fold_rules, {
    // Create a new Prog for each quote.
    visit_quote(tree: QuoteNode,
      [frames, progs]: [QuoteLiftFrame[], Prog[]]):
      [QuoteLiftFrame[], Prog[]]
    {
      // Push an empty context for the recursion.
      let frames_inner = cons(quote_lift_frame(), frames);
      let [f, p] = fold_rules.visit_quote(tree, [frames_inner, progs]);

      // The filled-in result at the top of the stack is the data for this
      // quote.
      let frame = hd(f);

      // Ad a new Prog to the list of products.
      let p2 = p.slice(0);
      p2[tree.id] = {
        id: tree.id,
        body: tree.expr,
        annotation: tree.annotation,
        bound: frame.bound,
        persist: frame.persists,
        splice: frame.splices,
        subprograms: frame.subprograms,
      };

      // Pop off the frame we just consumed at the head of the recursion
      // result. Then add this program as a subprogram of the containing
      // program.
      let tail = tl(f);
      let old = hd(tail);
      let f2 = cons(assign(old, {
        subprograms: cons(tree.id, old.subprograms),
      }), tl(tail));
      return [f2, p2];
    },

    // Add bound variables to the bound set.
    visit_let(tree: LetNode,
      [frames, progs]: [QuoteLiftFrame[], Prog[]]):
      [QuoteLiftFrame[], Prog[]]
    {
      let [f, p] = fold_rules.visit_let(tree, [frames, progs]);

      // Add a new bound variable to the top frame post-recursion.
      let old = hd(f);
      let f2 = cons(assign(old, {
        bound: set_add(old.bound, tree.id),
      }), tl(f));
      return [f2, p];
    },

    visit_escape(tree: EscapeNode,
      [frames, progs]: [QuoteLiftFrame[], Prog[]]):
      [QuoteLiftFrame[], Prog[]]
    {
      // Pop off the current context when recursing.
      let [f, p] = fself(tree.expr, [tl(frames), progs]);

      // Construct a new ProgEscape for this node.
      let esc: ProgEscape = {
        id: tree.id,
        body: tree.expr,
      };

      // Add this node to the *current* escapes. This time, we add to the
      // frame that we popped off for recursion.
      let old = hd(frames);
      let newf: QuoteLiftFrame;
      if (tree.kind === "persist") {
        newf = assign(old, {
          persists: cons(esc, old.persists),
        });
      } else if (tree.kind === "splice") {
        newf = assign(old, {
          splices: cons(esc, old.splices),
        });
      } else {
        throw "unknown escape kind";
      }

      // Then slap the updated frame back onto the remainder of the result
      // returned from the recursion.
      let f2 = cons(newf, f);
      return [f2, p];
    },
  });

  return function (tree: SyntaxNode,
    [frames, progs]: [QuoteLiftFrame[], Prog[]]):
    [QuoteLiftFrame[], Prog[]]
  {
    return ast_visit(rules, tree, [frames, progs]);
  };
};

let _quote_lift = fix(gen_quote_lift);
function quote_lift(tree: SyntaxNode): Prog[] {
  let [_, progs] = _quote_lift(tree, [[quote_lift_frame()], []]);
  return progs;
}

// Given tables of Procs and Procs, index them by their containing Progs.
// Return:
// - A list of unquoted Procs.
// - A table of lists of quoted Procs, indexed by the Prog ID.
// (Quoted progs are already listed in the `subprograms` field.
function group_by_prog(procs: Proc[], progs: Prog[]): [number[], number[][]] {
  // Initialize the tables for quoted procs and progs.
  let quoted: number[][] = [];
  for (let prog of progs) {
    if (prog !== undefined) {
      quoted[prog.id] = [];
    }
  }

  // Insert each proc where it goes.
  let toplevel: number[] = [];
  for (let proc of procs) {
    if (proc !== undefined) {
      if (proc.quote === null) {
        toplevel.push(proc.id);
      } else {
        quoted[proc.quote].push(proc.id);
      }
    }
  }

  return [toplevel, quoted];
}

// Find the containing Prog ID for each Prog.
function get_containing_progs(progs: Prog[]): number[] {
  let containing_progs: number[] = [];

  for (let prog of progs) {
    if (prog !== undefined) {
      for (let subprog of prog.subprograms) {
        containing_progs[subprog] = prog.id;
      }
    }
  }

  return containing_progs;
}

// Find all the `extern`s in a program.
type FindExterns = ASTFold<string[]>;
function gen_find_externs(fself: FindExterns): FindExterns {
  let fold_rules = ast_fold_rules(fself);
  let rules = compose_visit(fold_rules, {
    visit_extern(tree: ExternNode, externs: string[]): string[] {
      let e = externs.slice(0);
      e[tree.id] = tree.name;
      return e;
    }
  });
  return function (tree: SyntaxNode, externs: string[]): string[] {
    return ast_visit(rules, tree, externs);
  };
}
let find_externs = fix(gen_find_externs);

// The mid-level IR structure.
interface CompilerIR {
  // The def/use table.
  defuse: DefUseTable;

  // The lambda-lifted Procs. We have all the Procs except main, indexed by
  // ID, and main separately.
  procs: Proc[];
  main: Proc;

  // The quote-lifted Progs. Again, the Progs are indexed by ID.
  progs: Prog[];

  // Association tables between Progs and their associated Procs. Also, a list
  // of Procs from the top level---not associated with any quote.
  toplevel_procs: number[];
  quoted_procs: number[][];

  // The containing Prog ID for each Prog (or undefined for top-level Progs).
  containing_progs: number[];

  // Type elaboration.
  type_table: TypeTable;

  // Names of externs, indexed by the `extern` expression ID.
  externs: string[];
}

// This is the semantic analysis that produces our mid-level IR given an
// elaborated, desugared AST.
function semantically_analyze(tree: SyntaxNode,
  type_table: TypeTable, intrinsics: TypeMap = {}): CompilerIR
{
  // Give IDs to the intrinsics and add them to the type table.
  let intrinsics_map: NameMap = {};
  for (let name in intrinsics) {
    let id = type_table.length;
    type_table[id] = [intrinsics[name], null];
    intrinsics_map[name] = id;
  }

  let table = find_def_use(tree, intrinsics_map);

  // Lambda lifting and quote lifting.
  let [procs, main] = lambda_lift(tree, table);
  let progs = quote_lift(tree);

  // Prog-to-Proc mapping.
  let [toplevel_procs, quoted_procs] = group_by_prog(procs, progs);
  // Prog-to-Prog mapping.
  let containing_progs = get_containing_progs(progs);

  // Find the "real" externs in the program, and add the intrinsics to the
  // map.
  let externs = find_externs(tree, []);
  for (let name in intrinsics_map) {
    let id = intrinsics_map[name];
    externs[id] = name;
  }

  return {
    defuse: table,
    procs: procs,
    progs: progs,
    main: main,
    toplevel_procs: toplevel_procs,
    quoted_procs: quoted_procs,
    containing_progs: containing_progs,
    type_table: type_table,
    externs: externs,
  };
}
