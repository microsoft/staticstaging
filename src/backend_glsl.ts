/// <reference path="visit.ts" />
/// <reference path="util.ts" />
/// <reference path="compile.ts" />
/// <reference path="backends.ts" />
/// <reference path="type.ts" />

// Special GLSL matrix and vector types.
const FLOAT3 = new PrimitiveType("Float3");
const FLOAT4 = new PrimitiveType("Float4");
const FLOAT3X3 = new PrimitiveType("Float3x3");
const FLOAT4X4 = new PrimitiveType("Float4x4");
const ARRAY = new ConstructorType("Array");
const GL_TYPES: TypeMap = {
  "Float3": FLOAT3,
  "Float4": FLOAT4,
  "Vec3": FLOAT3,  // Convenient OpenGL-esque names.
  "Vec4": FLOAT4,
  "Float3x3": FLOAT3X3,
  "Float4x4": FLOAT4X4,
  "Mat3": FLOAT3,
  "Mat4": FLOAT4,
  "INT3": new PrimitiveType("Int3"),
  "INT4": new PrimitiveType("Int4"),
  "Array": ARRAY,
};


// Checking for our magic `vtx` and `frag` intrinsics, which indicate the
// structure of shader programs.
// This could be more efficient by using the ID of the extern. For now, we
// just match on the name.

function is_intrinsic(tree: CallNode, name: string) {
  if (tree.fun.tag === "lookup") {
    let fun = <LookupNode> tree.fun;
    return fun.ident === name;
  }
  return false;
}

function is_intrinsic_call(tree: ExpressionNode, name: string) {
  if (tree.tag === "call") {
    return is_intrinsic(tree as CallNode, name);
  }
  return false;
}

function vtx_expr(tree: ExpressionNode) {
  return is_intrinsic_call(tree, "vtx");
}

function frag_expr(tree: ExpressionNode) {
  return is_intrinsic_call(tree, "frag");
}

function glsl_emit_extern(name: string, type: Type): string {
  return name;
}


// The core compiler rules for emitting GLSL code.

type GLSLCompile = (tree: SyntaxNode) => string;
function glsl_compile_rules(fself: GLSLCompile, ir: CompilerIR):
  ASTVisit<void, string>
{
  return {
    visit_literal(tree: LiteralNode, param: void): string {
      return tree.value.toString();
    },

    visit_seq(tree: SeqNode, param: void): string {
      return emit_seq(tree, ",\n", fself,
        e => e.tag !== "extern" && e.tag !== "lookup"
      );
    },

    visit_let(tree: LetNode, param: void): string {
      let varname = varsym(tree.id);
      return varname + " = " + paren(fself(tree.expr));
    },

    visit_assign(tree: AssignNode, param: void): string {
      return emit_assign(ir, fself, tree);
    },

    visit_lookup(tree: LookupNode, param: void): string {
      return emit_lookup(ir, fself, glsl_emit_extern, tree);
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
      if (frag_expr(tree)) {
        // The argument must be a literal quote node.
        let arg = tree.args[0];
        if (arg.tag === "quote") {
          let quote = <QuoteNode> arg;

          // Assign to all the variables corresponding persists for the
          // fragment shader's quotation.
          // TODO Maybe this should move to the end of emission instead of the
          // call rule.
          let subprog = ir.progs[quote.id];
          let assignments: string[] = [];
          for (let esc of subprog.persist) {
            let varname = persistsym(esc.id);
            let value = fself(esc.body);
            assignments.push(varname + " = " + paren(value));
          }

          if (assignments.length) {
            return "/* pass to fragment shader */\n" +
                   assignments.join(",\n");
          } else {
            return "";
          }

        } else {
          throw "error: non-quote used with frag";
        }
      }

      // Check that it's a static call.
      if (tree.fun.tag === "lookup") {
        let fun = fself(tree.fun);
        let args: string[] = [];
        for (let arg of tree.args) {
          args.push(fself(arg));
        }
        return fun + "(" + args.join(", ") + ")";
      }

      throw "error: GLSL backend is not higher-order";
    },

    visit_extern(tree: ExternNode, param: void): string {
      let [defid, _] = ir.defuse[tree.id];
      let name = ir.externs[defid];
      return glsl_emit_extern(name, null);
    },

    visit_persist(tree: PersistNode, param: void): string {
      throw "error: persist cannot appear in source";
    },

  };
}

// Tie the recursion knot.
function get_glsl_compile(ir: CompilerIR): GLSLCompile {
  let rules = glsl_compile_rules(f, ir);
  function f (tree: SyntaxNode): string {
    return ast_visit(rules, tree, null);
  };
  return f;
}

function emit_glsl_decl(qualifier: string, type: string, name: string) {
  return qualifier + " " + type + " " + name + ";";
}

function emit_glsl_type(type: Type): string {
  if (type instanceof PrimitiveType) {
    if (type.name === "Int") {
      return "int";
    } else {
      throw "error: invalid primitive type " + type.name;
    }
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
  out += main;
  return out;
}
