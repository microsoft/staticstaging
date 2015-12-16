/// <reference path="../ast.ts" />
/// <reference path="../compile/ir.ts" />

module Backends {

// A type for core code-generation functions.
export type Compile = (tree: SyntaxNode, emitter: Emitter) => string;

// A structure containing everything needed to generate code.
export interface Emitter {
  // The program to compile.
  ir: CompilerIR,

  // Tree substitutions to use during code generation. This is a map from
  // expression node IDs to SyntaxNodes representing the new, substituted
  // code.
  substitutions: SyntaxNode[],

  // The core code-emission function for expressions.
  compile: Compile,

  // Compile a Proc (lifted function).
  emit_proc: (emitter: Emitter, proc: Proc) => string,

  // Compile a Prog (lifted quote).
  emit_prog: (emitter: Emitter, prog: Prog) => string,
}

// Compile the main function.
export function emit_main(emitter: Emitter) {
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

// Generate code for an expression.
export function emit(emitter: Emitter, tree: SyntaxNode) {
  let sub = emitter.substitutions[tree.id];
  if (sub !== undefined) {
    tree = sub;
  }
  return emitter.compile(tree, emitter);
}

// Add some substitutions to an Emitter, returning a new Emitter.
export function emitter_with_subs(emitter: Emitter, subs: SyntaxNode[]):
  Emitter
{
  // Overlay the `subs` map on the existing substitutions.
  let combined_subs = emitter.substitutions.slice(0);
  for (let i = 0; i < subs.length; ++i) {
    if (subs[i] !== undefined) {
      combined_subs[i] = subs[i];
    }
  }

  // Construct a new Emitter.
  return assign({}, emitter, { substitutions: combined_subs }) as Emitter;
}

}
