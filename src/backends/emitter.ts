/// <reference path="../ast.ts" />
/// <reference path="../compile/ir.ts" />

module Backends {

export type Compile = (tree: SyntaxNode) => string;

// A structure containing everything needed to customize code emission.
export interface Emitter {
  // The core code-emission function for expressions.
  compile: Compile,

  // Compile a Proc (lifted function).
  emit_proc: (emitter: Emitter, ir: CompilerIR, proc: Proc) => string,

  // Compile a Prog (lifted quote).
  emit_prog: (emitter: Emitter, ir: CompilerIR, prog: Prog) => string,
}

// Compile the main function.
export function emit(emitter: Emitter, ir: CompilerIR) {
  return emitter.emit_proc(emitter, ir, ir.main);
}

}
