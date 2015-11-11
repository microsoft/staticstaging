/// <reference path="../ast.ts" />
/// <reference path="../type_elaborate.ts" />

// The def/use table: for every use node ID, the corresponding definition (let
// or parameter) node ID.
type DefUseTable = number[];

interface Scope {
  id: number,  // or null for top-level
  body: ExpressionNode,
  free: number[],  // variables referenced here, defined elsewhere
  bound: number[],  // variables defined here

  // Explicit escapes.
  persist: ProgEscape[],
  splice: ProgEscape[],

  // Containing and contained scopes.
  parent: number,
  children: number[],

  // Similarly, for jumping directly through functions to quotes.
  quote_parent: number,
  quote_children: number[],
}

// A procedure is a lambda-lifted function. It includes the original body of
// the function and the IDs of the parameters and the closed-over free
// variables used in the function.
interface Proc extends Scope {
  params: number[],
};

interface ProgEscape {
  id: number,
  body: ExpressionNode,
}

// A Prog represents a quoted program. It's the quotation analogue of a Proc.
// Progs can have bound variables but not free variables.
interface Prog extends Scope {
  annotation: string,
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

  // Type elaboration.
  type_table: TypeTable;

  // Names of externs, indexed by the `extern` expression ID.
  externs: string[];

  // Containing scopes for every tree node.
  scopes: number[],

  // TODO transitional
  is_prog: boolean[],
}
