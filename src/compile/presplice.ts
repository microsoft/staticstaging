/// <reference path="ir.ts" />

module PreSplice {

type Config = number[];

function get_presplice_configs(progs: Prog[], prog: Prog): Config[] {
  let options: number[][] = [];

  for (let esc of prog.owned_snippet) {
    options[esc.id] = [];
    for (let other_prog of progs) {
      if (other_prog !== undefined) {
        if (other_prog.snippet_escape === esc.id) {
          options[esc.id].push(other_prog.id);
        }
      }
    }
  }

  console.log(options);
  return null;
}

export function presplice(progs: Prog[]) {
  for (let prog of progs) {
    if (prog !== undefined) {
      get_presplice_configs(progs, prog);
    }
  }
}

}
