// Utilities used by the various code-generation backends.

/// <reference path="ast.ts" />

// Get a variable name for an ATW variable by its defining node ID.
function varsym(defid: number) {
  return 'v' + defid;
}

// Get a function name for an ATW Proc by its ID, which is the same as the
// defining `fun` node ID.
function procsym(procid: number) {
  return "f" + procid;
}

// Get a string constant name for an ATW quotation (i.e., a Prog) by its ID,
// which is the same as the `quote` node ID.
function progsym(progid: number) {
  return "q" + progid;
}

// Get a *placeholder token* for a splice escape. This will be used with find
// & replace to substitute in code into an expression.
// TODO Eventually, a better implementation of this idea would just
// concatenate string fragments instead of using find & replace.
function splicesym(escid: number) {
  return "__SPLICE_" + escid + "__";
}

// Get a variable name for communicating *persist* escapes into an `eval`
// call.
function persistsym(escid: number) {
  return "p" + escid;
}

// Parenthesize an expression.
function paren(e: string) {
  return "(" + e + ")";
}

// Repeat a string n times.
function repeat(s: string, n: number): string {
  let o = "";
  for (let i = 0; i < n; ++i) {
    o += s;
  }
  return o;
}

// Indent a string by a given number of spaces.
function indent(s: string, first=false, spaces=2): string {
  let space = repeat(" ", spaces);
  let out = s.replace(/\n/g, "\n" + space);
  if (first) {
    out = space + out;
  }
  return out;
}

// A helper for emitting sequence expressions without emitting unneeded code.
function emit_seq(seq: SeqNode, sep: string, fallback: string,
    emit: (_:ExpressionNode) => string,
    pred: (_:ExpressionNode) => boolean): string {
  let e1 = pred(seq.lhs);
  let e2 = pred(seq.rhs);
  let out = "";
  if (e1) {
    out += emit(seq.lhs);
    if (e2) {
      out += sep;
    }
  }
  if (e2) {
    out += emit(seq.rhs);
  }
  if (!e1 && !e2) {
    out = fallback;
  }
  return out;
}
