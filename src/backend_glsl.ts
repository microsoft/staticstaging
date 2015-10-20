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
      throw "unimplemented";
    },

    visit_let(tree: LetNode, param: void): string {
      throw "unimplemented";
    },

    visit_lookup(tree: LookupNode, param: void): string {
      throw "unimplemented";
    },

    visit_binary(tree: BinaryNode, param: void): string {
      throw "unimplemented";
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
      throw "unimplemented";
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

function glsl_compile_prog(compile: GLSLCompile, prog: Prog,
    procs: Proc[], type_table: TypeTable): string {
  // TODO compile the functions
  // TODO compile the bound variable declarations

  // Declare `in` variables for the persists.
  let decls: string[] = [];
  for (let esc of prog.persist) {
    let [type, _] = type_table[esc.body.id];
    decls.push(emit_glsl_decl("in", emit_glsl_type(type), persistsym(esc.id)));
  }

  // Wrap the code in a "main" function.
  let code = compile(prog.body);
  let main = "void main() {\n" + code + "\n}";

  let out = decls.join("\n") + "\n";
  out += main + "\n";
  return out;
}
