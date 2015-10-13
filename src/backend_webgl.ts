/// <reference path="util.ts" />
/// <reference path="compile.ts" />
/// <reference path="backend_js.ts" />
/// <reference path="backend_glsl.ts" />

// Compile the IR to a JavaScript program that uses WebGL and GLSL.
function webgl_compile(ir: CompilerIR): string {
  let _jscompile = fix(gen_jscompile(ir.procs, ir.progs, ir.defuse));
  let _glslcompile = fix(gen_glslcompile(ir.procs, ir.progs, ir.defuse));

  return "???";
}
