/// <reference path="visit.ts" />
/// <reference path="util.ts" />
/// <reference path="compile.ts" />
/// <reference path="backends.ts" />
/// <reference path="type.ts" />
/// <reference path="type_check.ts" />

// Special GLSL matrix and vector types.
// Someday, a more structured notion of generic vector and matrix types would
// be better. For now, we just support a handful of common types.
const FLOAT3 = new PrimitiveType("Float3");
const FLOAT4 = new PrimitiveType("Float4");
const FLOAT3X3 = new PrimitiveType("Float3x3");
const FLOAT4X4 = new PrimitiveType("Float4x4");
const ARRAY = new ConstructorType("Array");
const INT3 = new PrimitiveType("Int3");
const INT4 = new PrimitiveType("Int4");
const GL_TYPES: TypeMap = {
  "Float3": FLOAT3,
  "Float4": FLOAT4,
  "Vec3": FLOAT3,  // Convenient OpenGL-esque names.
  "Vec4": FLOAT4,
  "Float3x3": FLOAT3X3,
  "Float4x4": FLOAT4X4,
  "Mat3": FLOAT3X3,
  "Mat4": FLOAT4X4,
  "INT3": INT3,
  "INT4": INT4,
  "Array": ARRAY,
};

const NUMERIC_TYPES: Type[] = [
  FLOAT3, FLOAT4,
  FLOAT3X3, FLOAT4X4,
  INT3, INT4,
];

const GLSL_TYPE_NAMES: { [_: string]: string } = {
  "Int": "int",
  "Int3": "ivec3",
  "Int4": "ivec4",
  "Float": "float",
  "Float3": "vec3",
  "Float4": "vec4",
  "Float3x3": "mat3",
  "Float4x4": "mat4",
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


// Type checking for uniforms, which are automatically demoted from arrays to
// individual values when they persist.

function gl_type_mixin(fsuper: TypeCheck): TypeCheck {
  let type_rules = complete_visit(fsuper, {
    // The goal here is to take lookups into prior stages of type `X Array`
    // and turn them into type `X`.
    visit_lookup(tree: LookupNode, env: TypeEnv): [Type, TypeEnv] {
      // Look up the type and stage of a variable.
      let [stack, _, __] = env;
      let [t, pos] = stack_lookup(stack, tree.ident);
      if (t !== undefined && pos > 0) {
        if (t instanceof InstanceType) {
          if (t.cons === ARRAY) {
            // Return the inner type (the array element type).
            return [t.arg, env];
          }
        }
      }

      return fsuper(tree, env);
    },
    // TODO Also do the same for ordinary persist-escapes.
  });

  return function (tree: SyntaxNode, env: TypeEnv): [Type, TypeEnv] {
    return ast_visit(type_rules, tree, env);
  };
};


// The core compiler rules for emitting GLSL code.

type GLSLCompile = (tree: SyntaxNode) => string;
function glsl_compile_rules(fself: GLSLCompile, ir: CompilerIR):
  ASTVisit<void, string>
{
  return {
    visit_literal(tree: LiteralNode, param: void): string {
      let [t, _] = ir.type_table[tree.id];
      if (t === INT) {
        return tree.value.toString();
      } else if (t === FLOAT) {
        // Make sure that even whole numbers are emitting as floating-point
        // literals.
        let out = tree.value.toString();
        if (out.indexOf(".") === -1) {
          return out + ".0";
        } else {
          return out;
        }
      } else {
        throw "error: unknown literal type";
      }
    },

    visit_seq(tree: SeqNode, param: void): string {
      return emit_seq(tree, ",\n", fself);
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
    let name = GLSL_TYPE_NAMES[type.name];
    if (name === undefined) {
      throw "error: primitive type " + type.name + " unsupported in GLSL";
    } else {
      return name;
    }
  } else {
    throw "error: type unsupported in GLSL: " + type;
  }
}

function glsl_persist_decl(ir: CompilerIR, esc: ProgEscape,
    out: boolean): string {
  let qual = out ? "out" : "in";
  let [type, _] = ir.type_table[esc.body.id];

  // Array types indicate an attribute. Use the element type. Attributes get
  // no special qualifier distinction from uniforms; they both just get marked
  // as `in` variables.
  let decl_type = type;
  if (type instanceof InstanceType) {
    if (type.cons === ARRAY) {
      decl_type = type.arg;
    }
  }

  return emit_glsl_decl(qual, emit_glsl_type(decl_type), persistsym(esc.id));
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
  let code = emit_body(compile, prog.body, "");
  let main = "void main() {\n" + indent(code, true) + "\n}";

  let out = "";
  if (decls.length) {
    out += decls.join("\n") + "\n";
  }
  out += main;
  return out;
}
