/// <reference path="ast.ts" />
/// <reference path="compile.ts" />

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
function emit_seq(seq: SeqNode, sep: string,
    emit: (_:ExpressionNode) => string,
    pred: (_:ExpressionNode) => boolean,
    rhs_prefix: string = null): string {
  let e1 = pred(seq.lhs);
  let out = "";
  if (pred(seq.lhs)) {
    out += emit(seq.lhs);
    out += sep;
  }
  if (rhs_prefix) {
    out += rhs_prefix;
  }
  out += emit(seq.rhs);
  return out;
}

// A helper for emitting assignments. Handles both externs and normal
// variables.
function emit_assign(ir: CompilerIR, emit: (_:ExpressionNode) => string,
    tree: AssignNode): string {
  let [defid, _] = ir.defuse[tree.id];
  let extern = ir.externs[defid];
  if (extern !== undefined) {
    // Extern assignment.
    return extern + " = " + paren(emit(tree.expr));
  } else {
    // Ordinary variable assignment.
    let jsvar = varsym(defid);
    return jsvar + " = " + paren(emit(tree.expr));
  }
}

// A helper for emitting lookups. Also handles both externs and ordinary
// variables.
function emit_lookup(ir: CompilerIR, emit: (_:ExpressionNode) => string,
    emit_extern: (name: string, type: Type) => string,
    tree: LookupNode): string {
  let [defid, _] = ir.defuse[tree.id];
  let name = ir.externs[defid];
  if (name !== undefined) {
    let [type, _] = ir.type_table[tree.id];
    return emit_extern(name, type);
  } else {
    // An ordinary variable lookup.
    return varsym(defid);
  }
}

// Flatten sequence trees. This is used at the top level of a function, where
// we want to emit a sequence of statements followed by a `return`.
function flatten_seq(tree: SyntaxNode): ExpressionNode[] {
  let rules = complete_visit(
  function (tree: SyntaxNode) {
    return [tree];
  },
  {
    visit_seq(tree: SeqNode, p: void): ExpressionNode[] {
      let lhs = flatten_seq(tree.lhs);
      let rhs = flatten_seq(tree.rhs);
      return lhs.concat(rhs);
    }
  });
  return ast_visit(rules, tree, null);
};
