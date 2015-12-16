/// <reference path="../visit.ts" />
/// <reference path="../util.ts" />
/// <reference path="../compile/compile.ts" />
/// <reference path="emitutil.ts" />
/// <reference path="emitter.ts" />

module Backends.JS {

export const RUNTIME = `
function assign() {
  var t = arguments[0];
  for (var i = 1; i < arguments.length; ++i)
    for (var k in arguments[i])
      t[k] = arguments[i][k];
  return t;
}
function splice(outer, id, inner, level) {
  var token = '__SPLICE_' + id + '__';
  var code = inner.prog;
  for (var i = 0; i < level; ++i) {
    // Escape the string to fit at the appropriate nesting level.
    code = JSON.stringify(code).slice(1, -1);
  }
  return {
    prog: outer.prog.replace(token, code),
    persist: assign({}, outer.persist, inner.persist)
  };
}
function call(closure, args) {
  return closure.proc.apply(void 0, args.concat(closure.env));
}
function run(code) {
  // Get the persist names and values to bind.
  var params = [];
  var args = [];
  for (var name in code.persist) {
    params.push(name);
    args.push(code.persist[name]);
  }

  // Inject the names into the quote's top-level function wrapper.
  var js = code.prog.replace("()", "(" + params.join(", ") + ")");
  // Strip off the invocation from the end.
  js = js.slice(0, -2);
  // Invoke the extracted function.
  var func = eval(js);
  return func.apply(void 0, args);
}
`.trim();


// Code-generation utilities.

function _is_fun_type(type: Types.Type): boolean {
  if (type instanceof Types.FunType) {
    return true;
  } else if (type instanceof Types.OverloadedType) {
    return _is_fun_type(type.types[0]);
  } else {
    return false;
  }
}

function emit_extern(name: string, type: Types.Type) {
  if (_is_fun_type(type)) {
    // The extern is a function. Wrap it in the clothing of our closure
    // format (with no environment).
    return "{ proc: " + name + ", env: [] }";
  } else {
    // An ordinary value. Just look it up by name.
    return name;
  }
}

// Create a JavaScript function definition. `name` can be null, in which case
// this is an anonymous function expression.
export function emit_fun(name: string, argnames: string[],
    localnames: string[], body: string): string
{
  let anon = (name === null);

  // Emit the definition.
  let out = "";
  if (anon) {
    out += "(";
  }
  out += "function ";
  if (!anon) {
    out += name;
  }
  out += "(" + argnames.join(", ") + ") {\n";
  if (localnames.length) {
    out += "  var " + localnames.join(", ") + ";\n";
  }
  out += indent(body, true);
  out += "\n}";
  if (anon) {
    out += ")";
  }
  return out;
}

// Wrap some code in an anonymous JavaScript function (and possibly invoke it)
// to isolate its variables. The code should define a function called `main`,
// which we will invoke.
export function emit_main_wrapper(code: string, call=true): string {
  let inner_code = code + "\n" + "return main();";
  let wrapper = emit_fun(null, [], [], inner_code);
  if (call) {
    return wrapper + "()";
  } else {
    return wrapper;
  }
}

// Turn a value into a JavaScript string literal. Mutli-line strings become
// nice, readable multi-line concatenations. (This will be obviated by ES6's
// template strings.)
export function emit_string(value: string) {
  if (typeof(value) === "string") {
    let parts: string[] = [];
    let chunks = value.split("\n");
    for (let i = 0; i < chunks.length; ++i) {
      let chunk = chunks[i];
      if (i < chunks.length - 1) {
        chunk += "\n";
      }
      parts.push(JSON.stringify(chunk));
    }
    return parts.join(" +\n");
  } else {
    return JSON.stringify(value);
  }
}

// Emit a JavaScript variable declaration. If `verbose`, then there will be a
// newline between the name and the beginning of the initialization value.
export function emit_var(name: string, value: string, verbose=false): string {
  let out = "var " + name + " =";
  if (verbose) {
    out += "\n";
  } else {
    out += " ";
  }
  out += value;
  out += ";";
  return out;
}

// Like `pretty_value`, but for values in the *compiled* JavaScript world.
export function pretty_value(v: any): string {
  if (typeof v == 'number') {
    return v.toString();
  } else if (v.proc !== undefined) {
    return "(fun)";
  } else if (v.prog !== undefined) {
    // It is a non-goal of this backend to be able to pretty-print quotations.
    // You can use the interpreter if you want that.
    return "<quote>";
  } else {
    throw "error: unknown value kind";
  }
}


// The core recursive compiler rules.

export let compile_rules = {
  visit_literal(tree: LiteralNode, emitter: Emitter): string {
    return tree.value.toString();
  },

  visit_seq(tree: SeqNode, emitter: Emitter): string {
    return emit_seq(emitter, tree, ",\n");
  },

  visit_let(tree: LetNode, emitter: Emitter): string {
    let jsvar = varsym(tree.id);
    return jsvar + " = " + paren(emit(emitter, tree.expr));
  },

  visit_assign(tree: LetNode, emitter: Emitter): string {
    return emit_assign(emitter, tree);
  },

  visit_lookup(tree: LookupNode, emitter: Emitter): string {
    return emit_lookup(emitter, emit_extern, tree);
  },

  visit_unary(tree: UnaryNode, emitter: Emitter): string {
    let p = emit(emitter, tree.expr);
    return tree.op + paren(p);
  },

  visit_binary(tree: BinaryNode, emitter: Emitter): string {
    let p1 = emit(emitter, tree.lhs);
    let p2 = emit(emitter, tree.rhs);
    return paren(p1) + " " + tree.op + " " + paren(p2);
  },

  visit_quote(tree: QuoteNode, emitter: Emitter): string {
    return emit_quote(emitter, tree.id);
  },

  visit_escape(tree: EscapeNode, emitter: Emitter): string {
    if (tree.kind === "splice") {
      return splicesym(tree.id);
    } else if (tree.kind === "persist") {
      return persistsym(tree.id);
    } else if (tree.kind === "snippet") {
      // We should only see this when pre-splicing is disabled.
      return splicesym(tree.id);
    } else {
      throw "error: unknown escape kind";
    }
  },

  visit_run(tree: RunNode, emitter: Emitter): string {
    // Compile the expression producing the program we need to invoke.
    let progex = emit(emitter, tree.expr);

    let [t, _] = emitter.ir.type_table[tree.expr.id];
    if (t instanceof Types.CodeType) {
      // Invoke the appropriate runtime function for executing code values.
      // We use a simple call wrapper for "progfuncs" and a more complex
      // `eval` trick for ordinary string code.
      if (t.annotation === "f") {
        return `call((${progex}), [])`;
      } else {
        return `run(${paren(progex)})`;
      }
    } else {
      throw "error: running non-code type";
    }
  },

  // A function expression produces a closure value.
  visit_fun(tree: FunNode, emitter: Emitter): string {
    return emit_func(emitter, tree.id);
  },

  // An invocation unpacks the closure environment and calls the function
  // with its normal arguments and its free variables.
  visit_call(tree: CallNode, emitter: Emitter): string {
    // Compile the function and arguments.
    let func = emit(emitter, tree.fun);
    let args: string[] = [];
    for (let arg of tree.args) {
      args.push(paren(emit(emitter, arg)));
    }

    // Invoke our runtime to complete the closure call.
    return "call(" + paren(func) + ", [" + args.join(", ") + "])";
  },

  visit_extern(tree: ExternNode, emitter: Emitter): string {
    let name = emitter.ir.externs[tree.id];
    let [type, _] = emitter.ir.type_table[tree.id];
    return emit_extern(name, type);
  },

  visit_persist(tree: PersistNode, emitter: Emitter): string {
    throw "error: persist cannot appear in source";
  },

  visit_if(tree: IfNode, emitter: Emitter): string {
    return emit_if(emitter, tree);
  },
};

function compile(tree: SyntaxNode, emitter: Emitter) {
  return ast_visit(compile_rules, tree, emitter);
}


// Code value emission for quote and function nodes.

// Emit a closure value, which consists of a pair of the code reference and
// the environment (persists and free variables).
function _emit_closure(name: string, env: string[]) {
  return `{ proc: ${name}, env: [${env.join(', ')}] }`;
}

// Get all the names of free variables in a scope.
// In Python: [varsym(id) for id in scope.free]
function _free_vars(scope: Scope) {
  let names: string[] = [];
  for (let fv of scope.free) {
    names.push(varsym(fv));
  }
  return names;
}

// Get a list of key/value pairs for the persists in a Program. The key is the
// JavaScript variable name indicating the persist; the value is either the
// expression to compute its value or just the name again to pass along a
// value from an outer quote.
function _persists(emitter: Emitter, prog: Prog): [string, string][] {
  let pairs: [string, string][] = [];
  for (let esc of prog.persist) {
    let key = persistsym(esc.id);
    let value: string;
    if (esc.prog === prog.id) {
      // We own this persist. Compute the expression.
      value = paren(emit(emitter, esc.body));
    } else {
      // Just pass along the pre-computed value.
      value = key;
    }
    pairs.push([key, value]);
  }
  return pairs;
}

// Emit a function expression as a closure.
function emit_func(emitter: Emitter, scopeid: number):
  string
{
  let args = _free_vars(emitter.ir.procs[scopeid]);

  // The function captures its closed-over references and any persists
  // used inside.
  for (let p of emitter.ir.procs[scopeid].persist) {
    args.push(persistsym(p.id));
  }

  return _emit_closure(procsym(scopeid), args);
}

// Emit a quote as a function closure (i.e., for an f<> quote).
function emit_quote_func(emitter: Emitter, scopeid: number):
  string
{
  let args = _free_vars(emitter.ir.progs[scopeid]);

  // Compile each persist so we can pass it in the environment.
  for (let [key, value] of _persists(emitter, emitter.ir.progs[scopeid])) {
    args.push(value);
  }

  let prog_expr = emit_quote_prog_expr(emitter, scopeid);
  return _emit_closure(prog_expr, args);
}

// Generate code for a splice escape. This first generates the code to
// evaluate the expression inside the escape, producing a code value. Then, it
// invokes the runtime to splice the result into the base program value, given
// as `code`.
function emit_splice(emitter: Emitter, esc: Escape, code: string): string {
  let esc_expr = emit(emitter, esc.body);

  // Determine how many levels of *eval* quotes are between the owning
  // quotation and the place where the expression needs to be inserted. This
  // is the number of string-escaping rounds we need.
  let eval_quotes = 0;
  let cur_quote = nearest_quote(emitter.ir, esc.id);
  for (let i = 0; i < esc.count - 1; ++i) {
    let prog = emitter.ir.progs[cur_quote];
    if (prog.annotation !== "f") {
      ++eval_quotes;
    }
    cur_quote = prog.quote_parent;
  }

  // Emit the call to the `splice` runtime function.
  return `splice(${code}, ${esc.id}, ${paren(esc_expr)}, ${eval_quotes})`;
}

// Emit the expression that gets the appropriate program (i.e., code pointer)
// for a quote expression. If this program has no variants, then this is a
// single variable reference. Otherwise, it looks up the correct variant in
// the appropriate table.
function emit_quote_prog_expr(emitter: Emitter, scopeid: number): string {
  if (emitter.ir.presplice_variants[scopeid] === null) {
    // No snippets to pre-splice.
    return progsym(scopeid);
  } else {
    // Emit code for each snippet escape to generate the name of the variant
    // to select.
    let id_exprs: string[] = [];
    for (let esc of emitter.ir.progs[scopeid].owned_snippet) {
      id_exprs.push(paren(emit(emitter, esc.body)));
    }
    let name_expr = `[${id_exprs.join(", ")}].join("_")`;
    return `${vartablesym(scopeid)}[${name_expr}]`;
  }
}

// Emit a quote as a full code value (which supports splicing).
function emit_quote_eval(emitter: Emitter, scopeid: number):
  string
{
  // Compile each persist in this quote and pack them into a dictionary.
  let persist_pairs: string[] = [];
  for (let [key, value] of _persists(emitter, emitter.ir.progs[scopeid])) {
    persist_pairs.push(`${key}: ${value}`);
  }

  // Include free variables as persists.
  for (let fv of emitter.ir.progs[scopeid].free) {
    persist_pairs.push(varsym(fv) + ": " + varsym(fv));
  }

  // Create the initial program.
  let prog_expr = emit_quote_prog_expr(emitter, scopeid);
  let pers_list = `{ ${persist_pairs.join(", ")} }`;
  let code_expr = `{ prog: ${prog_expr}, persist: ${pers_list} }`;

  // Compile each spliced escape expression and call our runtime to splice it
  // into the code value.
  for (let esc of emitter.ir.progs[scopeid].owned_splice) {
    code_expr = emit_splice(emitter, esc, code_expr);
  }

  return code_expr;
}

// Emit a quote. The kind of JavaScript value depends on the annotation.
function emit_quote(emitter: Emitter, scopeid: number): string
{
  if (emitter.ir.progs[scopeid].snippet_escape !== null) {
    // A snippet quote. Just produce the ID.
    return scopeid.toString();

  } else if (emitter.ir.progs[scopeid].annotation === "f") {
    // A function quote.
    return emit_quote_func(emitter, scopeid);

  } else {
    // An eval (string) quote.
    return emit_quote_eval(emitter, scopeid);
  }
}


// Common utilities for emitting Scopes (Procs and Progs).

// Compile all the Procs and progs who are children of a given scope.
function _emit_subscopes(emitter: Emitter, scope: Scope) {
  let out = "";
  for (let id of scope.children) {
    let res = emit_scope(emitter, id);
    if (res !== "") {
      out += res + "\n";
    }
  }
  return out;
}

// Get all the names of bound variables in a scope.
// In Python: [varsym(id) for id in scope.bound]
function _bound_vars(scope: Scope) {
  let names: string[] = [];
  for (let bv of scope.bound) {
    names.push(varsym(bv));
  }
  return names;
}

// Compile the body of a Scope as a JavaScript function.
function _emit_scope_func(emitter: Emitter, name: string,
    argnames: string[], scope: Scope): string {
  // Emit all children scopes.
  let subscopes = _emit_subscopes(emitter, scope);

  // Emit the target function code.
  let localnames = _bound_vars(scope);
  let body = emit_body(emitter, scope.body);

  let func = emit_fun(name, argnames, localnames, body);
  return subscopes + func;
}


// Compiling Procs.

// Compile a single Proc to a JavaScript function definition. If the Proc is
// main, then it is an anonymous function expression; otherwise, this produces
// an appropriately named function declaration.
export function emit_proc(emitter: Emitter, proc: Proc):
  string
{
  // The arguments consist of the actual parameters, the closure environment
  // (free variables), and the persists used inside the function.
  let argnames: string[] = [];
  for (let param of proc.params) {
    argnames.push(varsym(param));
  }
  for (let fv of proc.free) {
    argnames.push(varsym(fv));
  }
  for (let p of proc.persist) {
    argnames.push(persistsym(p.id));
  }

  // Get the name of the function, or null for the main function.
  let name: string;
  if (proc.id === null) {
    name = 'main';
  } else {
    name = procsym(proc.id);
  }

  return _emit_scope_func(emitter, name, argnames, proc);
}


// Compiling Progs.

// Compile a quotation (a.k.a. Prog) to a string constant. Also compiles the
// Procs that appear inside this quotation.
function emit_prog_eval(emitter: Emitter, prog: Prog, name: string): string
{
  // Emit (and invoke) the main function for the program.
  let code = emit_main_wrapper(_emit_scope_func(emitter, 'main', [], prog));

  // Wrap the whole thing in a variable declaration.
  return emit_var(name, emit_string(code), true);
}

// Emit a program as a JavaScript function declaration. This works when the
// program has no splices, and it avoids the overhead of `eval`.
function emit_prog_func(emitter: Emitter, prog: Prog, name: string): string
{
  // The must be no splices.
  if (prog.owned_splice.length) {
    throw "error: splices not allowed in a function quote";
  }

  // Free variables become parameters.
  let argnames: string[] = [];
  for (let fv of prog.free) {
    argnames.push(varsym(fv));
  }

  // Same with the quote's persists.
  for (let esc of prog.persist) {
    argnames.push(persistsym(esc.id));
  }

  return _emit_scope_func(emitter, name, argnames, prog);
}

// Emit a JavaScript Prog (a single variant). The backend depends on the
// annotation.
function emit_prog_decl(emitter: Emitter, prog: Prog, name: string): string {
  if (prog.annotation === "f") {
    // A function quote. Compile to a JavaScript function.
    return emit_prog_func(emitter, prog, name);
  } else {
    // An ordinary quote. Compile to a string.
    return emit_prog_eval(emitter, prog, name);
  }
}

// Emit a JavaScript Prog, possibly including multiple variants.
export function emit_prog(emitter: Emitter, prog: Prog): string
{
  // Check whether this is a snippet, in which case we don't emit it at all.
  if (prog.snippet_escape !== null) {
    return "";
  }

  // Check for a single variant.
  let variants = emitter.ir.presplice_variants[prog.id];
  if (variants === null) {
    // Just emit the program.
    return emit_prog_decl(emitter, prog, progsym(prog.id));
  }

  // Multiple variants. Compile each.
  let out = "";
  let table: { [name: string]: string } = {};
  for (let variant of variants) {
    let [config, subs] = variant;
    let varid = variant_id(config);
    let name = progsym(prog.id) + "_" + varid;
    let subemitter = emitter_with_subs(emitter, subs);
    out += emit_prog_decl(subemitter, prog, name) + "\n";
    table[varid] = name;
  }

  // Emit a table mapping names to programs.
  let table_str = "{\n";
  for (let key in table) {
    let value = table[key];
    table_str += `  ${emit_string(key)}: ${value},\n`;
  }
  table_str += "}";
  out += emit_var(vartablesym(prog.id), table_str, false);
  return out;
}


// Top-level compilation.

// Compile the IR to a complete JavaScript program.
export function codegen(ir: CompilerIR): string {
  let emitter: Emitter = {
    ir: ir,
    substitutions: [],
    compile: compile,
    emit_proc: emit_proc,
    emit_prog: emit_prog,
  };

  // Emit and invoke the main (anonymous) function.
  return emit_main_wrapper(Backends.emit_main(emitter));
}

}
