/// <reference path="ir.ts" />

module PreSplice {

type Variant = number[];

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

function get_variants(progs: Prog[], prog: Prog): Variant[] {
  // Get the space of possible options for each snippet escape.
  let options: number[][] = [];
  let indices: number[] = [];
  let i = 0;
  for (let esc of prog.owned_snippet) {
    let esc_options: number[] = [];
    options[i] = esc_options;
    indices[esc.id] = i;
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

  // The "configurations" are lists of resolutions (i.e., quote IDs) for each
  // snippet escape in a program.
  let configs = cross_product(options);

  console.log('options', options);
  console.log('indices', indices);
  console.log('configs', configs);

  return null;
}

export function presplice(progs: Prog[]) {
  for (let prog of progs) {
    if (prog !== undefined) {
      get_variants(progs, prog);
    }
  }
}

}
