/// <reference path="ir.ts" />
/// <reference path="../visit.ts" />
/// <reference path="../util.ts" />

// Bookkeeping for the quote-lifting process. This struct holds all the
// details that need to be passed recursively through quote-lifting to
// construct Progs.
interface QuoteLiftFrame {
  progid: number,  // Or null for outside any quote.
  bound: number[],  // List of local variable IDs.
  persists: ProgEscape[],  // Persist escapes in the quote.
  splices: ProgEscape[],  // Splice escapes.
  subprograms: number[],  // IDs of contained quotes.
};

function quote_lift_frame(id: number): QuoteLiftFrame {
  return {
    progid: id,
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
      let frames_inner = cons(quote_lift_frame(tree.id), frames);
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
        csr: [],
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
  let [_, progs] = _quote_lift(tree, [[quote_lift_frame(null)], []]);
  return progs;
}

