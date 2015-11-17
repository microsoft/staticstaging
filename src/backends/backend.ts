/// <reference path="../ast.ts" />
/// <reference path="../compile/ir.ts" />

module Backends {

export type Compile = (tree: SyntaxNode) => string;

// A structure containing everything needed to customize code emission.
export interface Backend {
  // The core code-emission function for expressions.
  compile: Compile,

  // Compile a Proc (lifted function).
  emit_proc: (backend: Backend, ir: CompilerIR, proc: Proc) => string,

  // Compile a Prog (lifted quote).
  emit_prog: (backend: Backend, ir: CompilerIR, prog: Prog) => string,
}

// Compile the main function.
export function emit(backend: Backend, ir: CompilerIR) {
  return backend.emit_proc(backend, ir, ir.main);
}

}
