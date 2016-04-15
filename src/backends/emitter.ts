import { SyntaxNode } from '../ast';
import { Proc, Prog, CompilerIR, Variant } from '../compile/ir';
import { assign } from '../util';

// A type for core code-generation functions.
export type Compile = (tree: SyntaxNode, emitter: Emitter) => string;

/**
 * A structure containing everything needed to generate code.
 */
export interface Emitter {
  /**
   * The program we're compiling.
   */
  ir: CompilerIR;

  /**
   * The core code-emission function for expressions.
   */
  compile: Compile;

  /**
   * Compile a Proc (lifted function).
   */
  emit_proc: (emitter: Emitter, proc: Proc) => string;

  /**
   * Compile a Prog (lifted quote) without variants.
   */
  emit_prog: (emitter: Emitter, prog: Prog) => string;

  /**
   * Compile a Prog's variant.
   */
  emit_prog_variant: (emitter: Emitter, variant: Variant, prog: Prog) => string;

  /**
   * The current variant we're compiling (or `null`).
   */
  variant: Variant;
}

// Compile the main function.
export function emit_main(emitter: Emitter) {
  return emitter.emit_proc(emitter, emitter.ir.main);
}

/**
 * Get the current specialized version of a program, according to the
 * emitter's current variant.
 */
function specialized_prog(emitter: Emitter, progid: number) {
  let variant = emitter.variant;
  if (!variant) {
    return emitter.ir.progs[progid];
  }

  return variant.progs[progid] || emitter.ir.progs[progid];
}

/**
 * Emit a `Prog`, either single- or multi-variant.
 */
function emit_prog(emitter: Emitter, prog: Prog) {
  if (prog.snippet_escape !== null) {
    // Do not emit snippets separately.
    return "";
  }

  // Check for variants. If there are none, just emit a single program.
  let variants = emitter.ir.presplice_variants[prog.id];
  if (variants === null) {
    return emitter.emit_prog(emitter, specialized_prog(emitter, prog.id));
  }

  // Multiple variants. Compile each.
  let out = "";
  for (let variant of variants) {
    let subemitter = assign({}, emitter);
    subemitter.variant = variant;
    out += emitter.emit_prog_variant(
      subemitter, variant, specialized_prog(subemitter, variant.progid)
    );
  }
  return out;
}

/**
 * Emit either kind of scope.
 */
export function emit_scope(emitter: Emitter, scope: number) {
  // Try a Proc.
  let proc = emitter.ir.procs[scope];
  if (proc) {
    return emitter.emit_proc(emitter, proc);
  }

  // Try a Prog.
  let prog = emitter.ir.progs[scope];
  if (prog) {
    return emit_prog(emitter, prog);
  }

  throw "error: unknown scope id";
}

// Generate code for an expression.
export function emit(emitter: Emitter, tree: SyntaxNode) {
  return emitter.compile(tree, emitter);
}
