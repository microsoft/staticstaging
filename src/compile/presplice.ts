import { SyntaxNode } from '../ast';
import { hd, tl, cons } from '../util';
import { Prog, Variant } from './ir';

// Given a list of N sets of values, generate the cross product of these sets.
// That is, each array in the returned set will have length N, where the ith
// element in the array will be one of the items of the ith input set.
function cross_product<T> (sets: T[][]): T[][] {
  // Base cases.
  if (sets.length === 0) {
    return [];
  } else if (sets.length === 1) {
    let out: T[][] = [];
    for (let v of hd(sets)) {
      out.push([v]);
    }
    return out;
  }

  // Recursive case.
  let tail_product = cross_product(tl(sets));
  let out: T[][] = [];
  for (let v of hd(sets)) {
    for (let arr of tail_product) {
      out.push(cons(v, arr));
    }
  }
  return out;
}

// Compute all the possible Variants for a given program. If the program has
// no snippet splices, the result is `null` (rather than a single variant) to
// indicate that backends should not do variant selection.
function get_variants(progs: Prog[], prog: Prog): Variant[] {
  // Get the space of possible options for each snippet escape.
  let options: number[][] = [];
  let i = 0;
  for (let esc of prog.owned_snippet) {
    let esc_options: number[] = [];
    options[i] = esc_options;
    ++i;

    // Find all the snippet quotes corresponding to this snippet escape.
    for (let other_prog of progs) {
      if (other_prog !== undefined) {
        if (other_prog.snippet_escape === esc.id) {
          esc_options.push(other_prog.id);
        }
      }
    }
  }

  // No snippet escapes? Then the variant list is null.
  if (options.length === 0) {
    return null;
  }

  // The configurations are lists of resolutions (i.e., quote IDs) for each
  // snippet escape in a program. We now format these as ID -> SyntaxNode
  // maps, called `Variant`s.
  let out: Variant[] = [];
  for (let config of cross_product(options)) {
    let substitutions: SyntaxNode[] = [];

    let i = 0;
    for (let esc of prog.owned_snippet) {
      substitutions[esc.id] = progs[config[i]].body;
      ++i;
    }

    out.push([config, substitutions]);
  }
  return out;
}

// Get the sets of variants for all programs.
export function presplice(progs: Prog[]): Variant[][] {
  let variants: Variant[][] = [];
  for (let prog of progs) {
    if (prog !== undefined) {
      variants[prog.id] = get_variants(progs, prog);
    }
  }
  return variants;
}
