/// <reference path="visit.ts" />
/// <reference path="util.ts" />
/// <reference path="compile.ts" />

// Get a JavaScript variable name for an ATW variable by its defining node
// ID.
function varsym(defid: number) {
  return 'v' + defid;
}

// Get a JavaScript function name for an ATW Proc by its ID, which is the same
// as the defining `fun` node ID.
function procsym(procid: number) {
  return "f" + procid;
}

// Get a JavaScript string constant name for an ATW quotation (i.e., a Prog)
// by its ID, which is the same as the `quote` node ID.
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

// Get a JavaScript variable name for communicating *persist* escapes into an
// `eval` call.
function persistsym(escid: number) {
  return "p" + escid;
}

// Parenthesize a JavaScript expression.
function paren(e: string) {
  return "(" + e + ")";
}

// A tiny runtime provides our splicing routine.
const JS_RUNTIME =
"function assign() {\n" +
"  var t = arguments[0];\n" +
"  for (var i = 1; i < arguments.length; ++i)\n" +
"    for (var k in arguments[i])\n" +
"      t[k] = arguments[i][k];\n" +
"  return t;\n" +
"}\n" +
"function splice(outer, id, inner) {\n" +
"  return { prog: outer.prog.replace('__SPLICE_' + id + '__', inner.prog),\n" +
"    persist: assign({}, outer.persist, inner.persist) };\n" +
"}\n";

// The core recursive compiler rules. Takes an elaborated, desugared,
// lambda-lifted AST with its corresponding def/use table. Works on a single
// Proc or Prog body at a time.
type JSCompile = (tree: SyntaxNode) => string;
function gen_jscompile(procs: Proc[], progs: Prog[],
  defuse: DefUseTable): Gen<JSCompile>
{
  return function (fself: JSCompile): JSCompile {
    let compile_rules : ASTVisit<void, string> = {
      visit_literal(tree: LiteralNode, param: void): string {
        return tree.value.toString();
      },

      visit_seq(tree: SeqNode, param: void): string {
        let p1 = fself(tree.lhs);
        let p2 = fself(tree.rhs);
        return p1 + ",\n" + p2;
      },

      visit_let(tree: LetNode, param: void): string {
        let jsvar = varsym(tree.id);
        return jsvar + " = " + paren(fself(tree.expr));
      },

      visit_lookup(tree: LookupNode, param: void): string {
        let [defid, _] = defuse[tree.id];
        let jsvar = varsym(defid);
        return jsvar;
      },

      visit_binary(tree: BinaryNode, param: void): string {
        let p1 = fself(tree.lhs);
        let p2 = fself(tree.rhs);
        return paren(p1) + " " + tree.op + " " + paren(p2);
      },

      visit_quote(tree: QuoteNode, param: void): string {
        // Compile each persist in this quote and pack them into a dictionary.
        let persist_pairs: string[] = [];
        for (let esc of progs[tree.id].persist) {
          let esc_expr = fself(esc.body);
          persist_pairs.push(persistsym(esc.id) + ": " + paren(esc_expr));
        }
        let persists_str = "{ " + persist_pairs.join(", ") + " }";

        // Create a pre-spliced code value.
        let code_expr = "{ prog: " + progsym(tree.id) +
          ", persist: " + persists_str + " }";

        // Compile each spliced escape expression. Then, call our runtime to
        // splice it into the code value.
        for (let esc of progs[tree.id].splice) {
          let esc_expr = fself(esc.body);
          code_expr = "splice(" + code_expr + ", " +
            esc.id + ", " +
            paren(esc_expr) + ")";
        }

        return code_expr;
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

        let out = "(function () {\n";
        out += "  var code = " + progex + ";\n";
        // To fill in the persist values, we currently use JavaScript's
        // much-maligned `with` statement. It's just what we need!
        out += "  with (code.persist)\n";
        out += "  return eval(code.prog);\n";
        out += "})()";
        return out;
      },

      // A function expression produces an object containing the JavaScript
      // function for the corresponding proc and a list of environment
      // variables.
      visit_fun(tree: FunNode, param: void): string {
        let captures: string[] = [];
        for (let fv of procs[tree.id].free) {
          captures.push(varsym(fv));
        }

        // Assemble the pair.
        let out = "{ proc: " + procsym(tree.id) + ", ";
        out += "env: [" + captures.join(', ') + "]}";
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

        // Get the closure pair, then invoke the first part on the arguments
        // and the second part.
        let out = "closure = " + paren(func) + ",\n";
        out += "  args = [" + args.join(", ") + "].concat(closure.env),\n";
        out += "  closure.proc.apply(void 0, args)";

        return out;
      },

      visit_persist(tree: PersistNode, param: void): string {
        throw "error: persist cannot appear in source";
      },
    }

    return function(tree: SyntaxNode): string {
      return ast_visit(compile_rules, tree, null);
    };
  }
}

// Create a JavaScript function definition. `name` can be null, in which case
// this is an anonymous function expression. `body` must be an expression (so
// we can `return` it).
function emit_js_fun(name: string, argnames: string[], localnames: string[], body: string): string {
  let anon = (name === null);

  // We always add our internal, temporary variables to the local declarations.
  localnames = localnames.concat(["closure", "args"]);

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
  out += "  var " + localnames.join(", ") + ";\n";
  out += "  return ";
  out += body.replace(/\n/g, "\n  ");
  out += ";\n}";
  if (anon) {
    out += ")";
  }
  return out;
}

// Compile a single Proc to a JavaScript function definition. If the Proc is
// main, then it is an anonymous function expression; otherwise, this produces
// an appropriately named function declaration.
function jscompile_proc(compile: JSCompile, proc: Proc): string {
  // The arguments consist of the actual parameters and the closure
  // environment (free variables).
  let argnames: string[] = [];
  for (let param of proc.params) {
    argnames.push(varsym(param));
  }
  for (let fv of proc.free) {
    argnames.push(varsym(fv));
  }

  // We also need the names of the non-parameter bound variables so we can
  // declare them.
  let localnames: string[] = [];
  for (let bv of proc.bound) {
    if (proc.params.indexOf(bv) == -1) {
      localnames.push(varsym(bv));
    }
  }

  // Check whether this is main (and hence anonymous).
  let name: string;
  if (proc.id === null) {
    name = null;
  } else {
    name = procsym(proc.id);
  }

  // Function declaration.
  return emit_js_fun(name, argnames, localnames, compile(proc.body));
}

// Compile a quotation (a.k.a. Prog) to a JavaScript string constant. Also
// compiles the Procs that appear inside this quotation.
function jscompile_prog(compile: JSCompile, prog: Prog, procs: Proc[]): string {
  // Compile each function defined in this quote.
  let procs_str = "";
  for (let proc of procs) {
    procs_str += jscompile_proc(compile, proc);
    procs_str += "\n";
  }

  // Get the quote's local (bound) variables.
  let localnames: string[] = [];
  for (let bv of prog.bound) {
    localnames.push(varsym(bv));
  }

  // Wrap the code in a function to avoid polluting the namespace.
  let code = compile(prog.body);
  let code_wrapped = emit_js_fun(null, [], localnames, code) + "()";

  // Then escape it as a JavaScript string.
  let code_str = JSON.stringify(procs_str + code_wrapped);

  return "var " + progsym(prog.id) + " = " + code_str + ";\n";
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

// Compile the IR to a complete JavaScript program.
function jscompile(ir: CompilerIR): string {
  let _jscompile = fix(gen_jscompile(ir.procs, ir.progs, ir.defuse));

  // Start with our run-time library.
  let out = JS_RUNTIME;

  // Compile each program to a string.
  for (let prog of ir.progs) {
    if (prog !== undefined) {
      out += jscompile_prog(_jscompile, prog, ir.quoted_procs[prog.id]);
    }
  }

  // Compile each proc to a JS function.
  for (let proc of ir.toplevel_procs) {
    out += jscompile_proc(_jscompile, proc);
    out += "\n";
  }

  // Emit and invoke the main (anonymous) function.
  out += jscompile_proc(_jscompile, ir.main);
  out += "()";

  return out;
}
