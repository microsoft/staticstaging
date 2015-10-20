/// <reference path="util.ts" />
/// <reference path="compile.ts" />
/// <reference path="backend_js.ts" />
/// <reference path="backend_glsl.ts" />

// Extend the JavaScript compiler with some WebGL specifics.
function webgl_compile_rules(fself: JSCompile, procs: Proc[], progs: Prog[],
  defuse: DefUseTable): ASTVisit<void, string>
{
  let js_rules = js_compile_rules(fself, procs, progs, defuse);
  return compose_visit(js_rules, {
    // Compile calls to our intrinsics for binding shaders.
    visit_call(tree: CallNode, p: void): string {
      // Check for the intrinsic.
      // TODO This should use a more robust `extern` system rather than a
      // naming convention...
      if (tree.fun.tag === "lookup") {
        let fun = <LookupNode> tree.fun;
        if (fun.ident === "frag") {
          // A shader invocation!
          let progex = fself(tree.args[0]);
          return "gl.useProgram(" + paren(progex) + ".prog)";
        }
      }

      // An ordinary function call.
      return ast_visit(js_rules, tree, null);
    },
  });
}

// Tie the recursion knot.
function get_webgl_compile(procs: Proc[], progs: Prog[],
                           defuse: DefUseTable): GLSLCompile {
  let rules = webgl_compile_rules(f, procs, progs, defuse);
  function f (tree: SyntaxNode): string {
    return ast_visit(rules, tree, null);
  };
  return f;
}

// Compile the IR to a JavaScript program that uses WebGL and GLSL.
function webgl_compile(ir: CompilerIR): string {
  let _jscompile = get_webgl_compile(ir.procs, ir.progs, ir.defuse);
  let _glslcompile = get_glsl_compile(ir.procs, ir.progs, ir.defuse);

  let out = "";

  // Compile each program to a string.
  for (let prog of ir.progs) {
    if (prog !== undefined) {
      let code: string;
      if (prog.annotation === "s") {
        // A shader program.
        code = glsl_compile_prog(_glslcompile, prog, ir.quoted_procs[prog.id],
                                 ir.type_table);
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
