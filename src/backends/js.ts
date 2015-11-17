/// <reference path="../visit.ts" />
/// <reference path="../util.ts" />
/// <reference path="../compile/compile.ts" />
/// <reference path="emitutil.ts" />
/// <reference path="backend.ts" />

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

function _is_fun_type(type: Type): boolean {
  if (type instanceof FunType) {
    return true;
  } else if (type instanceof OverloadedType) {
    return _is_fun_type(type.types[0]);
  } else {
    return false;
  }
}

function emit_extern(name: string, type: Type) {
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

export function compile_rules(fself: Compile, backend: Backend,
    ir: CompilerIR):
  ASTVisit<void, string>
{
  return {
    visit_literal(tree: LiteralNode, param: void): string {
      return tree.value.toString();
    },

    visit_seq(tree: SeqNode, param: void): string {
      return emit_seq(tree, ",\n", fself);
    },

    visit_let(tree: LetNode, param: void): string {
      let jsvar = varsym(tree.id);
      return jsvar + " = " + paren(fself(tree.expr));
    },

    visit_assign(tree: LetNode, param: void): string {
      return emit_assign(ir, fself, tree);
    },

    visit_lookup(tree: LookupNode, param: void): string {
      return emit_lookup(ir, fself, emit_extern, tree);
    },

    visit_unary(tree: UnaryNode, param: void): string {
      let p = fself(tree.expr);
      return tree.op + paren(p);
    },

    visit_binary(tree: BinaryNode, param: void): string {
      let p1 = fself(tree.lhs);
      let p2 = fself(tree.rhs);
      return paren(p1) + " " + tree.op + " " + paren(p2);
    },

    visit_quote(tree: QuoteNode, param: void): string {
      return emit_quote(backend, ir, tree.id);
    },

    visit_escape(tree: EscapeNode, param: void): string {
      if (tree.kind === "splice") {
        return splicesym(tree.id);
      } else if (tree.kind === "persist") {
        return persistsym(tree.id);
      } else {
        throw "error: unknown escape kind";
      }
    },

    visit_run(tree: RunNode, param: void): string {
      // Compile the expression producing the program we need to invoke.
      let progex = fself(tree.expr);

      let [t, _] = ir.type_table[tree.expr.id];
      if (t instanceof CodeType) {
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
    visit_fun(tree: FunNode, param: void): string {
      return emit_func(backend, ir, tree.id);
    },

    // An invocation unpacks the closure environment and calls the function
    // with its normal arguments and its free variables.
    visit_call(tree: CallNode, param: void): string {
      // Compile the function and arguments.
      let func = fself(tree.fun);
      let args: string[] = [];
      for (let arg of tree.args) {
        args.push(paren(fself(arg)));
      }

      // Invoke our runtime to complete the closure call.
      return "call(" + paren(func) + ", [" + args.join(", ") + "])";
    },

    visit_extern(tree: ExternNode, param: void): string {
      let name = ir.externs[tree.id];
      let [type, _] = ir.type_table[tree.id];
      return emit_extern(name, type);
    },

    visit_persist(tree: PersistNode, param: void): string {
      throw "error: persist cannot appear in source";
    },
  };
}

function get_compile(backend: Backend, ir: CompilerIR): Compile {
  let rules = compile_rules(f, backend, ir);
  function f (tree: SyntaxNode): string {
    return ast_visit(rules, tree, null);
  };
  return f;
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
function _persists(backend: Backend, prog: Prog): [string, string][] {
  let pairs: [string, string][] = [];
  for (let esc of prog.persist) {
    let key = persistsym(esc.id);
    let value: string;
    if (esc.prog === prog.id) {
      // We own this persist. Compute the expression.
      value = paren(backend.compile(esc.body));
    } else {
      // Just pass along the pre-computed value.
      value = key;
    }
    pairs.push([key, value]);
  }
  return pairs;
}

// Emit a function expression as a closure.
function emit_func(backend: Backend, ir: CompilerIR, scopeid: number):
  string
{
  let args = _free_vars(ir.procs[scopeid]);

  // The function captures its closed-over references and any persists
  // used inside.
  for (let p of ir.procs[scopeid].persist) {
    args.push(persistsym(p.id));
  }

  return _emit_closure(procsym(scopeid), args);
}

// Emit a quote as a function closure (i.e., for an f<> quote).
function emit_quote_func(backend: Backend, ir: CompilerIR, scopeid: number):
  string
{
  let args = _free_vars(ir.progs[scopeid]);

  // Compile each persist so we can pass it in the environment.
  for (let [key, value] of _persists(backend, ir.progs[scopeid])) {
    args.push(value);
  }

  return _emit_closure(progsym(scopeid), args);
}

// Emit a quote as a full code value (which supports splicing).
function emit_quote_eval(backend: Backend, ir: CompilerIR, scopeid: number):
  string
{
  // Compile each persist in this quote and pack them into a dictionary.
  let persist_pairs: string[] = [];
  for (let [key, value] of _persists(backend, ir.progs[scopeid])) {
    persist_pairs.push(`${key}: ${value}`);
  }

  // Include free variables as persists.
  for (let fv of ir.progs[scopeid].free) {
    persist_pairs.push(varsym(fv) + ": " + varsym(fv));
  }

  // Create a pre-spliced code value.
  let pers_list = `{ ${persist_pairs.join(", ")} }`;
  let code_expr = `{ prog: ${progsym(scopeid)}, persist: ${pers_list} }`;

  // Compile each spliced escape expression. Then, call our runtime to
  // splice it into the code value.
  for (let esc of ir.progs[scopeid].owned_splice) {
    let esc_expr = backend.compile(esc.body);

    // Determine how many levels of *eval* quotes are between the owning
    // quotation and the place where the expression needs to be inserted. This
    // is the number of string-escaping rounds we need.
    let eval_quotes = 0;
    let cur_quote = nearest_quote(ir, esc.id);
    for (let i = 0; i < esc.count - 1; ++i) {
      let prog = ir.progs[cur_quote];
      if (prog.annotation !== "f") {
        ++eval_quotes;
      }
      cur_quote = prog.quote_parent;
    }

    // Emit the call to the `splice` runtime function.
    code_expr =
      `splice(${code_expr}, ${esc.id}, ${paren(esc_expr)}, ${eval_quotes})`;
  }

  return code_expr;
}

// Emit a quote. The kind of JavaScript value depends on the annotation.
function emit_quote(backend: Backend, ir: CompilerIR, scopeid: number): string
{
  if (ir.progs[scopeid].annotation === "f") {
    return emit_quote_func(backend, ir, scopeid);
  } else {
    return emit_quote_eval(backend, ir, scopeid);
  }
}


// Common utilities for emitting Scopes (Procs and Progs).

// Emit either kind of scope.
function _emit_scope(backend: Backend, ir: CompilerIR, scope: number) {
  // Try a Proc.
  let proc = ir.procs[scope];
  if (proc) {
    return emit_proc(backend, ir, proc);
  }

  // Try a Prog.
  let prog = ir.progs[scope];
  if (prog) {
    return emit_prog(backend, ir, prog);
  }

  throw "error: unknown scope id";
}

// Compile all the Procs and progs who are children of a given scope.
function _emit_subscopes(backend: Backend, ir: CompilerIR, scope: Scope) {
  let out = "";
  for (let id of scope.children) {
    out += _emit_scope(backend, ir, id) + "\n";
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
function _emit_scope_func(backend: Backend, ir: CompilerIR, name: string,
    argnames: string[], scope: Scope, main=false): string {
  // Emit all children scopes.
  let subscopes = _emit_subscopes(backend, ir, scope);

  // Emit the target function code.
  let localnames = _bound_vars(scope);
  let body = emit_body(backend.compile, scope.body);

  // Construct the function wrapper. For the main (top-level) function, the
  // subscopes appear *inside* the body. Otherwise, they appear above.
  if (main) {
    body = subscopes + body;
  }
  let func = emit_fun(name, argnames, localnames, body);
  if (!main) {
    func = subscopes + func;
  }

  return func;
}


// Compiling Procs.

// Compile a single Proc to a JavaScript function definition. If the Proc is
// main, then it is an anonymous function expression; otherwise, this produces
// an appropriately named function declaration.
export function emit_proc(backend: Backend, ir: CompilerIR, proc: Proc):
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
  let main: boolean;
  if (proc.id === null) {
    name = null;
    main = true;
  } else {
    name = procsym(proc.id);
    main = false;
  }

  return _emit_scope_func(backend, ir, name, argnames, proc, main);
}


// Compiling Progs.

// Compile a quotation (a.k.a. Prog) to a string constant. Also compiles the
// Procs that appear inside this quotation.
function emit_prog_eval(backend: Backend, ir: CompilerIR,
    prog: Prog): string
{
  // Emit (and invoke) the main function for the program.
  let code = _emit_scope_func(backend, ir, null, [], prog, true);
  code += "()";

  // Wrap the whole thing in a variable declaration.
  return emit_var(progsym(prog.id), emit_string(code), true);
}

// Emit a program as a JavaScript function declaration. This works when the
// program has no splices, and it avoids the overhead of `eval`.
function emit_prog_func(backend: Backend, ir: CompilerIR,
    prog: Prog): string
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

  return _emit_scope_func(backend, ir, progsym(prog.id), argnames, prog);
}

// Emit a JavaScript Prog. The backend depends on the annotation.
export function emit_prog(backend: Backend, ir: CompilerIR,
    prog: Prog): string
{
  if (prog.annotation === "f") {
    // A function quote. Compile to a JavaScript function.
    return emit_prog_func(backend, ir, prog);

  } else {
    // An ordinary quote. Compile to a string.
    return emit_prog_eval(backend, ir, prog);
  }
}


// Top-level compilation.

// Compile the IR to a complete JavaScript program.
export function emit(ir: CompilerIR): string {
  let backend: Backend = {
    compile: null,
    emit_proc: emit_proc,
    emit_prog: emit_prog,
  };
  backend.compile = get_compile(backend, ir);

  // Emit and invoke the main (anonymous) function.
  return Backends.emit(backend, ir) + "()";
}

}
