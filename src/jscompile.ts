/// <reference path="visit.ts" />
/// <reference path="util.ts" />
/// <reference path="compile.ts" />

function varsym(defid: number) {
  return 'v' + defid;
}


function paren(e: string) {
  return "(" + e + ")";
}

type JSCompile = (tree: SyntaxNode) => string;
function gen_jscompile(procs: Proc[], defuse: DefUseTable): Gen<JSCompile> {
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
        throw "unimplemented";
      },

      visit_escape(tree: EscapeNode, param: void): string {
        throw "unimplemented";
      },

      visit_run(tree: RunNode, param: void): string {
        throw "unimplemented";
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
        let out = "closure = " + paren(func) + ", ";
        out += "args = [" + args.join(", ") + "].concat(closure.env), ";
        out += "closure.proc.apply(void 0, args)";

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

function procsym(id: number) {
  if (id === null) {
    return "main";
  } else {
    return "p" + id;
  }
}

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
  out += "var " + localnames.join(", ") + ";\n";
  out += "return ";
  out += compile(proc.body);
  out += ";\n}\n";
  return out;
}

// Like `pretty_value`, but for values in the *compiled* JavaScript world.
function pretty_js_value(v: any): string {
  if (typeof v == 'number') {
    return v.toString();
  } else if (v instanceof Object) {
    // This works because the only JS object type in compiled programs is a
    // closure value.
    return "(fun)";
  } else {
    throw "error: unknown value kind";
  }
  // TODO Format code values, whatever those are.
}

function jscompile(tree: SyntaxNode): string {
  let table = find_def_use(tree);

  let [procs, main] = lambda_lift(tree, table);

  let _jscompile = fix(gen_jscompile(procs, table));
  let out = "";
  for (let i = 0; i < procs.length; ++i) {
    if (procs[i] !== undefined) {
      out += jscompile_proc(_jscompile, procs[i]);
    }
  }
  out += jscompile_proc(_jscompile, main);
  out += "main()";
  return out;
}
