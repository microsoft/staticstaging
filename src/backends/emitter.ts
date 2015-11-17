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

}
