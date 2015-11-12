/// <reference path="../visit.ts" />
/// <reference path="../util.ts" />
/// <reference path="../compile/compile.ts" />
/// <reference path="backends.ts" />

const JS_RUNTIME = `
function assign() {
  var t = arguments[0];
  for (var i = 1; i < arguments.length; ++i)
    for (var k in arguments[i])
      t[k] = arguments[i][k];
  return t;
}
function splice(outer, id, inner) {
  return { prog: outer.prog.replace('__SPLICE_' + id + '__', inner.prog),
    persist: assign({}, outer.persist, inner.persist) };
}
function call(closure, args) {
  return closure.proc.apply(void 0, args.concat(closure.env));
}
function run(code) {
  // A crazy dance to bind the persist names.
  var params = ["c"];
  var args = [code.prog];
  for (var name in code.persist) {
    params.push(name);
    args.push(code.persist[name]);
  }
  var js = "(function (" + params.join(", ") + ") { return eval(c); })";
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

function js_emit_extern(name: string, type: Type) {
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
function emit_js_fun(name: string, argnames: string[], localnames: string[],
    body: string): string {
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
function emit_js_string(value: any) {
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
function emit_js_var(name: string, value: any, verbose=false): string {
  let out = "var " + name + " =";
  if (verbose) {
    out += "\n";
  } else {
    out += " ";
  }
  out += emit_js_string(value) + ";";
  return out;
}

// Like `pretty_value`, but for values in the *compiled* JavaScript world.
function pretty_js_value(v: any): string {
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

type JSCompile = (tree: SyntaxNode) => string;
function js_compile_rules(fself: JSCompile, ir: CompilerIR):
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
      return emit_lookup(ir, fself, js_emit_extern, tree);
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
      if (tree.annotation === "f") {
        // A function quote, which we compile to a JavaScript function. Emit
        // a closure value with the persists as arguments.
        let args: string[] = [];
        for (let esc of ir.progs[tree.id].persist) {
          if (esc !== undefined) {
            args.push(paren(fself(esc.body)));
          }
        }
        return `{ proc: ${progsym(tree.id)}, env: [${args.join(', ')}] }`;

      } else {
        // An ordinary string-eval quote, with the full power of splicing.

        // Compile each persist in this quote and pack them into a dictionary.
        let persist_pairs: string[] = [];
        for (let esc of ir.progs[tree.id].persist) {
          let esc_expr = fself(esc.body);
          persist_pairs.push(persistsym(esc.id) + ": " + paren(esc_expr));
        }
        let persists_str = "{ " + persist_pairs.join(", ") + " }";

        // Create a pre-spliced code value.
        let code_expr = "{ prog: " + progsym(tree.id) +
          ", persist: " + persists_str + " }";

        // Compile each spliced escape expression. Then, call our runtime to
        // splice it into the code value.
        for (let esc of ir.progs[tree.id].splice) {
          let esc_expr = fself(esc.body);
          code_expr = "splice(" + code_expr + ", " +
            esc.id + ", " +
            paren(esc_expr) + ")";
        }

        return code_expr;
      }
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

    // A function expression produces an object containing the JavaScript
    // function for the corresponding proc and a list of environment
    // variables.
    visit_fun(tree: FunNode, param: void): string {
      // The function captures its closed-over references and any persists
      // used inside.
      let captures: string[] = [];
      for (let fv of ir.procs[tree.id].free) {
        captures.push(varsym(fv));
      }
      for (let p of ir.procs[tree.id].persist) {
        captures.push(persistsym(p.id));
      }

      // Assemble the pair.
      let out = "{ proc: " + procsym(tree.id) + ", ";
      out += "env: [" + captures.join(', ') + "] }";
      return out;
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
      return js_emit_extern(name, type);
    },

    visit_persist(tree: PersistNode, param: void): string {
      throw "error: persist cannot appear in source";
    },
  };
}

function get_js_compile(ir: CompilerIR): JSCompile {
  let rules = js_compile_rules(f, ir);
  function f (tree: SyntaxNode): string {
    return ast_visit(rules, tree, null);
  };
  return f;
}


// Common utilities for emitting Scopes (Procs and Progs).

// Compile all the Procs who are children of a given scope.
function _emit_procs(compile: JSCompile, ir: CompilerIR, scope: number) {
  let out = "";
  for (let subproc of ir.procs) {
    if (subproc !== undefined) {
      if (subproc.parent === scope) {
        out += js_emit_proc(compile, ir, subproc);
        out += "\n";
      }
    }
  }
  return out;
}

function _bound_vars(ir: CompilerIR, scope: Scope) {
  let names: string[] = [];
  for (let bv of scope.bound) {
    names.push(varsym(bv));
  }
  return names;
}

// Compile the body of a Scope as a JavaScript function.
function _emit_scope_func(compile: JSCompile, ir: CompilerIR, name: string,
    argnames: string[], localnames: string[], scope: Scope): string {
  let body = emit_body(compile, scope.body);
  return emit_js_fun(name, argnames, localnames, body);
}


// Compiling Procs.

// Compile a single Proc to a JavaScript function definition. If the Proc is
// main, then it is an anonymous function expression; otherwise, this produces
// an appropriately named function declaration.
function js_emit_proc(compile: JSCompile, ir: CompilerIR, proc: Proc,
    wrapped=false): string
{
  // Declare local (bound) variables.
  let localnames = _bound_vars(ir, proc);

  // Emit all children functions.
  let procs = _emit_procs(compile, ir, proc.id);

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

  // Check whether this is main (and hence anonymous).
  let name: string;
  if (proc.id === null) {
    name = null;
  } else {
    name = procsym(proc.id);
  }

  // Declaration for this function declaration.
  let func = "";
  if (wrapped) {
    func = "return /* main */ ";
  }
  func += _emit_scope_func(compile, ir, name, argnames, localnames, proc);

  return procs + func;
}


// Compiling Progs.

// Compile a quotation (a.k.a. Prog) to a string constant. Also compiles the
// Procs that appear inside this quotation.
function js_emit_prog_eval(compile: JSCompile, ir: CompilerIR,
    prog: Prog): string
{
  // Declare local (bound) variables.
  let localnames = _bound_vars(ir, prog);

  // Emit all children functions.
  let procs = _emit_procs(compile, ir, prog.id);

  // Emit (and invoke) the main function for the program.
  let func = _emit_scope_func(compile, ir, null, [], localnames, prog);
  func += "()";

  // Wrap the whole thing in a variable declaration.
  let code = procs + func;
  return emit_js_var(progsym(prog.id), code, true);
}

// Emit a program as a JavaScript function declaration. This works when the
// program has no splices, and it avoids the overhead of `eval`.
function js_emit_prog_func(compile: JSCompile, ir: CompilerIR,
    prog: Prog): string
{
  // The must be no splices.
  if (prog.splice.length) {
    throw "error: splices not allowed in a program quote";
  }

  // Declare local (bound) variables.
  let localnames = _bound_vars(ir, prog);

  // Emit all children functions.
  let procs = _emit_procs(compile, ir, prog.id);

  // Get the quote's persists. These manifest as parameters to the function.
  let argnames: string[] = [];
  for (let esc of prog.persist) {
    argnames.push(persistsym(esc.id));
  }

  // Emit the main function, which takes the persists as parameters.
  let func = _emit_scope_func(compile, ir, progsym(prog.id), argnames,
      localnames, prog);

  return procs + func;
}

// Emit a JavaScript Prog. The backend depends on the annotation.
function js_emit_prog(compile: JSCompile, ir: CompilerIR,
    prog: Prog): string
{
  if (prog.annotation === "f") {
    // A function quote. Compile to a JavaScript function.
    return js_emit_prog_func(compile, ir, prog);

  } else {
    // An ordinary quote. Compile to a string.
    return js_emit_prog_eval(compile, ir, prog);
  }
}


// Top-level compilation.

// Compile the IR to a complete JavaScript program.
function jscompile(ir: CompilerIR): string {
  let _jscompile = get_js_compile(ir);

  let out = "";

  // Compile each program.
  for (let prog of ir.progs) {
    if (prog !== undefined) {
      out += js_emit_prog(_jscompile, ir, prog);
    }
  }

  // Emit and invoke the main (anonymous) function.
  out += js_emit_proc(_jscompile, ir, ir.main);
  out += "()";

  return out;
}
