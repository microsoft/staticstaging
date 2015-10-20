// Utilities used by the various code-generation backends.

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
