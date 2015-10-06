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
  if (procid === null) {
    return "main";
  } else {
    return "f" + procid;
  }
}

// Get a JavaScript string constant name for an ATW quotation (i.e., a Prog)
// by its ID, which is the same as the `quote` node ID.
function progsym(progid: number) {
  return "q" + progid;
}

// Parenthesize a JavaScript expression.
function paren(e: string) {
  return "(" + e + ")";
}

// The core recursive compiler rules. Takes an elaborated, desugared,
// lambda-lifted AST with its corresponding def/use table. Works on a single
// proc body at a time.
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
        return "{ prog: " + progsym(tree.id) + " }";
      },

      visit_escape(tree: EscapeNode, param: void): string {
        throw "unimplemented";
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

// Compile a single Proc to a JavaScript function definition.
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
  // We'll also declare our special "closure" and "args" temporaries, used for
  // invoking closures.
  localnames.push("closure");
  localnames.push("args");

  // Function declaration.
  let out =  "function " + procsym(proc.id) + "(";
  out += argnames.join(", ");
  out += ") {\n";
  out += "  var " + localnames.join(", ") + ";\n";
  out += "  return ";
  out += compile(proc.body).replace(/,\n/g, ",\n  ");
  out += ";\n}\n";
  return out;
}

// Like `pretty_value`, but for values in the *compiled* JavaScript world.
function pretty_js_value(v: any): string {
  if (typeof v == 'number') {
    return v.toString();
  } else if (v.proc !== undefined) {
    return "(fun)";
  } else if (v.prog !== undefined) {
    return "<quote>";
  } else {
    throw "error: unknown value kind";
  }
  // TODO Format code values, whatever those are.
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
  // TODO do something about the bound variables in this world
  for (let prog of progs) {
    if (prog !== undefined) {
      let code = _jscompile(prog.body);
      out += "var " + progsym(prog.id) + " = " + JSON.stringify(code) + ";\n";
    }
  }

  // Compile each proc to a JS function.
  for (let proc of procs) {
    if (proc !== undefined) {
      out += jscompile_proc(_jscompile, proc);
    }
  }
  out += jscompile_proc(_jscompile, main);

  // Invoke the main function.
  out += "main()";
  return out;
}
