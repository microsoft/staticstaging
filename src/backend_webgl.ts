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
  let _jscompile = get_js_compile(ir.procs, ir.progs, ir.defuse);
  let _glslcompile = get_webgl_compile(ir.procs, ir.progs, ir.defuse);

  let out = "";

  // Compile each program to a string.
  for (let prog of ir.progs) {
    if (prog !== undefined) {
      let code: string;
      if (prog.annotation === "s") {
        // A shader program.
        code = glsl_compile_prog(_glslcompile, prog, ir.quoted_procs[prog.id]);
      } else {
        // Ordinary JavaScript quotation.
        code = jscompile_prog(_jscompile, prog, ir.quoted_procs[prog.id]);
      }

      out += emit_js_var(progsym(prog.id), code) + "\n";
    }
  }

  // The main function.
  out += jscompile_proc(_jscompile, ir.main);
  out += "()";

  return out;
}
