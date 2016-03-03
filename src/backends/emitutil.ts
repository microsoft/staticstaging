import { Emitter, emit } from './emitter';
import * as ast from '../ast';
import { Type } from '../type';
import { complete_visit, ast_visit } from '../visit';

// Utilities used by the various code-generation backends.

// Get a variable name for an ATW variable by its defining node ID.
export function varsym(defid: number) {
  return 'v' + defid;
}

// Get a function name for an ATW Proc by its ID, which is the same as the
// defining `fun` node ID.
export function procsym(procid: number) {
  return "f" + procid;
}

// Get a string constant name for an ATW quotation (i.e., a Prog) by its ID,
// which is the same as the `quote` node ID.
export function progsym(progid: number) {
  return "q" + progid;
}

// Get a *placeholder token* for a splice escape. This will be used with find
// & replace to substitute in code into an expression.
// TODO Eventually, a better implementation of this idea would just
// concatenate string fragments instead of using find & replace.
export function splicesym(escid: number) {
  return "__SPLICE_" + escid + "__";
}

// Get a variable name for communicating *persist* escapes into an `eval`
// call.
export function persistsym(escid: number) {
  return "p" + escid;
}

// Get a variable name for the *variance table* for a pre-spliced program.
export function vartablesym(progid: number) {
  return "vt" + progid;
}

// Given a presplicing variant (an ID -> ID), generate a string that uniquely
// identifies the variant.
export function variant_id(config: number[]) {
  return config.join("_");
}

// Parenthesize an expression.
export function paren(e: string) {
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
export function indent(s: string, first=false, spaces=2): string {
  let space = repeat(" ", spaces);
  let out = s.replace(/\n/g, "\n" + space);
  if (first) {
    out = space + out;
  }
  return out;
}

// A helper for emitting sequence expressions without emitting unneeded code.
export function emit_seq(emitter: Emitter, seq: ast.SeqNode, sep: string,
    pred: (_: ast.ExpressionNode) => boolean = useful_pred): string
{
  let e1 = pred(seq.lhs);
  let out = "";
  if (pred(seq.lhs)) {
    out += emit(emitter, seq.lhs);
    out += sep;
  }
  out += emit(emitter, seq.rhs);
  return out;
}

// A helper for emitting assignments. Handles both externs and normal
// variables.
export function emit_assign(emitter: Emitter,
    tree: ast.AssignNode, get_varsym=varsym): string {
  let defid = emitter.ir.defuse[tree.id];
  let extern = emitter.ir.externs[defid];
  if (extern !== undefined) {
    // Extern assignment.
    return extern + " = " + paren(emit(emitter, tree.expr));
  } else {
    // Ordinary variable assignment.
    let jsvar = get_varsym(defid);
    return jsvar + " = " + paren(emit(emitter, tree.expr));
  }
}

// A helper for emitting lookups. Also handles both externs and ordinary
// variables.
export function emit_lookup(emitter: Emitter,
    emit_extern: (name: string, type: Type) => string,
    tree: ast.LookupNode,
    get_varsym=varsym): string {
  let defid = emitter.ir.defuse[tree.id];
  let name = emitter.ir.externs[defid];
  if (name !== undefined) {
    let [type, _] = emitter.ir.type_table[tree.id];
    return emit_extern(name, type);
  } else {
    // An ordinary variable lookup.
    return get_varsym(defid);
  }
}

// A helper for emitting if/then/else.
export function emit_if(emitter: Emitter, tree: ast.IfNode): string {
  let cond = emit(emitter, tree.cond);
  let truex = emit(emitter, tree.truex);
  let falsex = emit(emitter, tree.falsex);
  return `${paren(cond)} ? ${paren(truex)} : ${paren(falsex)}`;
}

// Flatten sequence trees. This is used at the top level of a function, where
// we want to emit a sequence of statements followed by a `return`.
function flatten_seq(tree: ast.SyntaxNode): ast.ExpressionNode[] {
  let rules = complete_visit(
    function (tree: ast.SyntaxNode) {
      return [tree];
    },
    {
      visit_seq(tree: ast.SeqNode, p: void): ast.ExpressionNode[] {
        let lhs = flatten_seq(tree.lhs);
        let rhs = flatten_seq(tree.rhs);
        return lhs.concat(rhs);
      }
    }
  );
  return ast_visit(rules, tree, null);
};

// A simple predicate to decide whether an expression is worth emitting,
// given a choice. This is used when emitting sequences to avoid generating
// worthless code.
function useful_pred(tree: ast.ExpressionNode): boolean {
  return ["extern", "lookup", "literal"].indexOf(tree.tag) === -1;
}

// Compile a top-level expression for the body of a function. The emitted code
// returns value of the function. The optional `pred` function can decide
// whether to emit (non-terminal) expressions.
export function emit_body(emitter: Emitter, tree: ast.SyntaxNode,
    ret="return ", sep=";",
    pred: (_: ast.ExpressionNode) => boolean = useful_pred): string
{
  let exprs = flatten_seq(tree);
  let statements: string[] = [];
  for (let i = 0; i < exprs.length; ++i) {
    let expr = exprs[i];
    let s = emit(emitter, expr);
    if (s.length) {
      if (i === exprs.length - 1) {
        statements.push(ret + emit(emitter, expr));
      } else if (pred(expr)) {
        statements.push(emit(emitter, expr));
      }
    }
  }
  return statements.join(sep + "\n") + sep;
}
