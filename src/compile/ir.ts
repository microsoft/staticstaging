import { SyntaxNode, ExpressionNode } from '../ast';
import { TypeTable } from '../type_elaborate';

// The def/use table: for every use node ID, the corresponding definition (let
// or parameter) node ID.
export type DefUseTable = number[];

export interface Scope {
  id: number,  // or null for top-level
  body: ExpressionNode,
  free: number[],  // variables referenced here, defined elsewhere
  bound: number[],  // variables defined here

  // Explicit escapes. These are lists of escapes that appear anywhere
  // inside the scope, regardless of the escape's level.
  persist: Escape[],
  splice: Escape[],
  snippet: Escape[],

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
export interface Proc extends Scope {
  params: number[],
};

export interface Escape {
  id: number;
  body: ExpressionNode;
  count: number;
  prog: number;  // The quote that *owns* this escape.
}

// A Prog represents a quoted program. It's the quotation analogue of a Proc.
// Progs can have bound variables but not free variables.
export interface Prog extends Scope {
  annotation: string;

  // Subsets of the overall escape lists for which this quote is the "owner"
  // of the escape. The owner is the quote at the level that matches the
  // escape's level count: the quote in whose *containing scope* the escape's
  // expression is evaluated. These are necessary when compiling escapes
  // because the owning quote is "responsible" for emitting the code for the
  // escapes it owns. For example, the owner performs splicing, not the quote
  // that directly *contains* the splice escape.
  owned_persist: Escape[];
  owned_splice: Escape[];
  owned_snippet: Escape[];

  // If this is a snippet program, the associated escape expression ID.
  // Otherwise, null.
  snippet_escape: number;
}

/**
 * A `Variant` represents a pre-spliced version of a quote with snippet
 * escapes.
 */
export interface Variant {
  /**
   * The ID of the original program from which this variant was generated.
   */
  progid: number;

  /**
   * The vector of IDs that uniquely identify the variant. Specifically, this
   * is the list of snippet-quote IDs that have been chosen for each
   * snippet-escape in the program, in order.
   */
  config: number[];

  /**
   * Replacement `Prog` values for any changed programs in this variant.
   */
  progs: Prog[];
}

// The mid-level IR structure.
export interface CompilerIR {
  // The def/use table.
  defuse: DefUseTable;

  // The lambda-lifted Procs. We have all the Procs except main, indexed by
  // ID, and main separately.
  procs: Proc[];
  main: Proc;

  // The quote-lifted Progs. Again, the Progs are indexed by ID.
  progs: Prog[];

  // Type elaboration.
  type_table: TypeTable;

  // Names of externs, indexed by the `extern` expression ID.
  externs: string[];

  // A mapping from every AST node ID to the containing scope ID.
  containers: number[],

  /**
   * For pre-splicing, a set of variants for each `Prog` that has snippet
   * escapes. Programs with no snippet escapes have a `null` value in this
   * map.
   */
  presplice_variants: Variant[][],
}

/**
 * Find the nearest containing quote to the syntax node. If the syntax node is
 * already a quote, it is returned.
 */
export function nearest_quote(ir: CompilerIR, id: number): number {
  // Is this the top-level scope already?
  if (id === null) {
    return null;
  }

  // Is this a quote itself?
  if (ir.progs[id]) {
    return id;
  }

  // Is it top-level?
  let scope = ir.containers[id];
  if (scope === null) {
    return null;
  }

  // Is the container a quote?
  if (ir.progs[scope]) {
    return scope;
  }

  // Otherwise, get the containing quote for the container.
  return ir.procs[scope].quote_parent;
}

/**
 * Type test for `Prog` as a subtype of `Scope`.
 */
export function is_prog(scope: Scope): scope is Prog {
  return (scope as Prog).annotation !== undefined;
}
