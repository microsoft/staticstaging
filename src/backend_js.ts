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

// Parenthesize a JavaScript expression.
function paren(e: string) {
  return "(" + e + ")";
}

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
        let strvar = progsym(tree.id);

        // Generate code to substitute in each spliced expression.
        let strexpr = strvar;
        for (let esc of progs[tree.id].splice) {
          let esc_expr = fself(esc.body);
          let esc_body_expr = paren(esc_expr) + ".prog";
          strexpr = strexpr + ".replace(" +
            JSON.stringify(splicesym(esc.id)) + ", " +
            esc_body_expr + ")";
        }

        return "{ prog: " + strexpr + " }";
      },

      visit_escape(tree: EscapeNode, param: void): string {
        if (tree.kind === "splice") {
          return splicesym(tree.id);
        } else {
          throw "unimplemented";
        }
      },

      visit_run(tree: RunNode, param: void): string {
        // TODO eval in a sandbox to avoid namespace pollution
        let progex = fself(tree.expr);
        return "eval((" + progex + ").prog)";
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
  out += body.replace(/,\n/g, ",\n  ");
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

// Compile a quotation (a.k.a. Prog) to a JavaScript string constant.
function jscompile_prog(compile: JSCompile, prog: Prog): string {
  // Get the quote's local (bound) variables.
  let localnames: string[] = [];
  for (let bv of prog.bound) {
    localnames.push(varsym(bv));
  }

  // Wrap the code in a function to avoid polluting the namespace.
  let code = compile(prog.body);
  let code_wrapped = emit_js_fun(null, [], localnames, code) + "()";

  // Then escape it as a JavaScript string.
  let code_str = JSON.stringify(code_wrapped);

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

// Compile an entire (elaborated, desugared) AST to a complete JavaScript
// program.
function jscompile(tree: SyntaxNode): string {
  let table = find_def_use(tree);

  let [procs, main] = lambda_lift(tree, table);
  let progs = quote_lift(tree);

  let _jscompile = fix(gen_jscompile(procs, progs, table));
  let out = "";

  // Compile each program to a string.
  for (let prog of progs) {
    if (prog !== undefined) {
      out += jscompile_prog(_jscompile, prog);
    }
  }

  // Compile each proc to a JS function.
  for (let proc of procs) {
    if (proc !== undefined) {
      out += jscompile_proc(_jscompile, proc);
      out += "\n";
    }
  }

  // Emit and invoke the main (anonymous) function.
  out += jscompile_proc(_jscompile, main);
  out += "()";

  return out;
}
