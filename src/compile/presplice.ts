/// <reference path="ir.ts" />

module PreSplice {

type Config = number[];

function get_presplice_configs(progs: Prog[], prog: Prog): Config[] {
  let options: number[][];
  for (let esc of prog.owned_snippet) {
    options[esc.id] = [];
    for (let prog of progs) {
      if (prog.snippet_escape === esc.id) {
        options[esc.id].push(prog.id);
      }
    }
  }

  console.log(options);
  return null;
}

}
