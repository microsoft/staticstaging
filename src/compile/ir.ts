/// <reference path="../ast.ts" />
/// <reference path="../type_elaborate.ts" />

// The main output of def/use analysis: For every lookup and assignment node
// ID, the table contains:
// * a defining node ID
// * and a flag indicating whether the variable is bound (vs. free) in the
//   function context
// * the number of "stages away" the lookup was defined: 0 for in the current
//   quote, nonzero for a cross-stage reference
type DefUseTable = [number, boolean, number][];

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
  persists: number[],
};

interface ProgEscape {
  id: number,
  body: ExpressionNode,
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
