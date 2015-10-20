/// <reference path="visit.ts" />
/// <reference path="util.ts" />
/// <reference path="compile.ts" />
/// <reference path="backends.ts" />

type GLSLCompile = (tree: SyntaxNode) => string;
function glsl_compile_rules(fself: GLSLCompile, procs: Proc[], progs: Prog[],
  defuse: DefUseTable): ASTVisit<void, string>
{
  return {
    visit_literal(tree: LiteralNode, param: void): string {
      return tree.value.toString();
    },

    visit_seq(tree: SeqNode, param: void): string {
      let p1 = fself(tree.lhs);
      let p2 = fself(tree.rhs);
      return p1 + ",\n" + p2;
    },

    visit_let(tree: LetNode, param: void): string {
      // TODO Ugh, more intrinsic ugliness.
      if (tree.ident === "frag") {
        return "";
      }

      let varname = varsym(tree.id);
      return varname + " = " + paren(fself(tree.expr));
    },

    visit_lookup(tree: LookupNode, param: void): string {
      let [defid, _] = defuse[tree.id];
      return varsym(defid);
    },

    visit_binary(tree: BinaryNode, param: void): string {
      return paren(fself(tree.lhs)) + " " +
             tree.op + " " +
             paren(fself(tree.rhs));
    },

    visit_quote(tree: QuoteNode, param: void): string {
      throw "unimplemented";
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
      throw "unimplemented";
    },

    visit_fun(tree: FunNode, param: void): string {
      throw "unimplemented";
    },

    visit_call(tree: CallNode, param: void): string {
      // TODO Again with the needing intrinsics...
      if (tree.fun.tag === "lookup") {
        let fun = <LookupNode> tree.fun;
        if (fun.ident === "frag") {
          // A transition to fragment shading.

          // The argument must be a literal quote node.
          let arg = tree.args[0];
          if (arg.tag === "quote") {
            let quote = <QuoteNode> arg;

            // Assign to all the variables corresponding persists for the
            // fragment shader's quotation.
            let subprog = progs[quote.id];
            let out = "/* pass to fragment shader*/\n";
            for (let esc of subprog.persist) {
              let varname = persistsym(esc.id);
              let value = fself(esc.body);
              out += varname + " = " + paren(value) + ",\n";
            }
            return out;

          } else {
            throw "error: non-quote used with frag";
          }
        }
      }

      throw "unimplemented";
    },

    visit_extern(tree: ExternNode, param: void): string {
      // TODO
      return "";
    },

    visit_persist(tree: PersistNode, param: void): string {
      throw "error: persist cannot appear in source";
    },

  };
}

// Tie the recursion knot.
function get_glsl_compile(procs: Proc[], progs: Prog[],
                          defuse: DefUseTable): GLSLCompile {
  let rules = glsl_compile_rules(f, procs, progs, defuse);
  function f (tree: SyntaxNode): string {
    return ast_visit(rules, tree, null);
  };
  return f;
}

function emit_glsl_decl(qualifier: string, type: string, name: string) {
  return qualifier + " " + type + " " + name + ";";
}

function emit_glsl_type(type: Type): string {
  if (type instanceof IntType) {
    return "int";
  } else {
    throw "unimplemented type " + type;
  }
}

function glsl_persist_decl(ir: CompilerIR, esc: ProgEscape,
    out: boolean): string {
  let qual = out ? "out" : "in";
  let [type, _] = ir.type_table[esc.body.id];
  return emit_glsl_decl(qual, emit_glsl_type(type), persistsym(esc.id));
}

function glsl_compile_prog(compile: GLSLCompile,
    ir: CompilerIR, progid: number): string {
  // TODO compile the functions
  // TODO compile the bound variable declarations

  let prog = ir.progs[progid];

  // Declare `in` variables for the persists.
  let decls: string[] = [];
  for (let esc of prog.persist) {
    decls.push(glsl_persist_decl(ir, esc, false));
  }

  // Declare `out` variables for the persists in the subprogram. There can be
  // at most one subprogram for every shader.
  if (prog.subprograms.length > 1) {
    throw "error: too many subprograms";
  } else if (prog.subprograms.length === 1) {
    let subprog = ir.progs[prog.subprograms[0]];
    for (let esc of subprog.persist) {
      if (esc !== undefined) {
        decls.push(glsl_persist_decl(ir, esc, true));
      }
    }
  }

  // Wrap the code in a "main" function.
  let code = compile(prog.body);
  let main = "void main() {\n" + indent(code, true) + "\n}";

  let out = "";
  if (decls.length) {
    out += decls.join("\n") + "\n";
  }
  out += main + "\n";
  return out;
}
