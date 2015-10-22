/// <reference path="util.ts" />
/// <reference path="compile.ts" />
/// <reference path="backend_js.ts" />
/// <reference path="backend_glsl.ts" />

function emit_shader_binding(emit: JSCompile, quote: QuoteNode) {
  let vertex_quote = progsym(quote.id);
  return "gl.useProgram(" + vertex_quote + ")";
}

// Extend the JavaScript compiler with some WebGL specifics.
function webgl_compile_rules(fself: JSCompile, ir: CompilerIR):
  ASTVisit<void, string>
{
  let js_rules = js_compile_rules(fself, ir);
  return compose_visit(js_rules, {
    // Compile calls to our intrinsics for binding shaders.
    visit_call(tree: CallNode, p: void): string {
      // Check for the intrinsic that indicates a shader invocation.
      if (vtx_expr(tree)) {
        // For the moment, we require a literal quote so we can statically
        // emit the bindings.
        if (tree.args[0].tag === "quote") {
          let quote = tree.args[0] as QuoteNode;
          return emit_shader_binding(fself, quote);
        } else {
          throw "dynamic `vtx` calls unimplemented";
        }
      }

      // An ordinary function call.
      return ast_visit(js_rules, tree, null);
    },
  });
}

// Tie the recursion knot.
function get_webgl_compile(ir: CompilerIR): GLSLCompile {
  let rules = webgl_compile_rules(f, ir);
  function f (tree: SyntaxNode): string {
    return ast_visit(rules, tree, null);
  };
  return f;
}

// Compile the IR to a JavaScript program that uses WebGL and GLSL.
function webgl_compile(ir: CompilerIR): string {
  let _jscompile = get_webgl_compile(ir);
  let _glslcompile = get_glsl_compile(ir);

  let out = "";

  // Compile each program to a string.
  for (let prog of ir.progs) {
    if (prog !== undefined) {
      let code: string;
      if (prog.annotation === "s") {
        // A shader program.
        code = glsl_compile_prog(_glslcompile, ir, prog.id);
      } else {
        // Ordinary JavaScript quotation.
        code = jscompile_prog(_jscompile, prog, ir.quoted_procs[prog.id]);
      }

      out += emit_js_var(progsym(prog.id), code, true) + "\n";
    }
  }

  // The main function.
  out += jscompile_proc(_jscompile, ir.main);
  out += "()";

  return out;
}
