/// <reference path="../ast.ts" />
/// <reference path="../compile/ir.ts" />

module Backends {

export type Compile = (tree: SyntaxNode) => string;

// A structure containing everything needed to generate code.
export interface Emitter {
  // The program to compile.
  ir: CompilerIR,

  // The core code-emission function for expressions.
  compile: Compile,

  // Compile a Proc (lifted function).
  emit_proc: (emitter: Emitter, proc: Proc) => string,

  // Compile a Prog (lifted quote).
  emit_prog: (emitter: Emitter, prog: Prog) => string,
}

// Compile the main function.
export function emit(emitter: Emitter) {
  return emitter.emit_proc(emitter, emitter.ir.main);
}

// Emit either kind of scope.
export function emit_scope(emitter: Emitter, scope: number) {
  // Try a Proc.
  let proc = emitter.ir.procs[scope];
  if (proc) {
    return emitter.emit_proc(emitter, proc);
  }

  // Try a Prog.
  let prog = emitter.ir.progs[scope];
  if (prog) {
    return emitter.emit_prog(emitter, prog);
  }

  throw "error: unknown scope id";
}

}
