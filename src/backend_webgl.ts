/// <reference path="util.ts" />
/// <reference path="compile.ts" />
/// <reference path="backend_js.ts" />
/// <reference path="backend_glsl.ts" />

const WEBGL_RUNTIME = `
function compile_glsl(gl, type, src) {
  var shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    var errLog = gl.getShaderInfoLog(shader);
    console.error("error: compiling shader:", errLog);
  }
  return shader;
}
function get_shader(gl, vertex_source, fragment_source) {
  var vert = compile_glsl(gl, gl.VERTEX_SHADER, vertex_source);
  var frag = compile_glsl(gl, gl.FRAGMENT_SHADER, fragment_source);
  var program = gl.createProgram();
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    var errLog = gl.getProgramInfoLog(program);
    console.error("error linking program:", errLog);
  }
  return program;
}
function bind_attribute(gl, location, buffer) {
  if (!buffer) {
    throw "no buffer";
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(location);
}
`.trim();

const _GL_BINARY_TYPE = new OverloadedType([
  new FunType([INT, INT], INT),
  new FunType([FLOAT, FLOAT], FLOAT),
  new FunType([FLOAT3, FLOAT3], FLOAT3),
  new FunType([FLOAT4, FLOAT4], FLOAT4),
  new FunType([FLOAT3X3, FLOAT3X3], FLOAT3X3),
  new FunType([FLOAT4X4, FLOAT4X4], FLOAT4X4),
]);
const _GL_MUL_TYPE = new OverloadedType([
  new FunType([INT, INT], INT),
  new FunType([FLOAT, FLOAT], FLOAT),
  new FunType([FLOAT3, FLOAT3], FLOAT3),
  new FunType([FLOAT4, FLOAT4], FLOAT4),
  new FunType([FLOAT3X3, FLOAT3X3], FLOAT3X3),
  new FunType([FLOAT4X4, FLOAT4X4], FLOAT4X4),

  // Multiplication gets special type cases for matrix-vector multiply.
  new FunType([FLOAT3X3, FLOAT3], FLOAT3),
  new FunType([FLOAT4X4, FLOAT4], FLOAT4),
]);
const GL_INTRINSICS: TypeMap = {
  render: new FunType([new CodeType(ANY)], VOID),
  vtx: new FunType([new CodeType(ANY)], VOID),
  frag: new FunType([new CodeType(ANY)], VOID),
  gl_Position: FLOAT4,
  gl_FragColor: FLOAT4,
  vec4: new FunType([FLOAT3, FLOAT], FLOAT4),
  abs: new OverloadedType([
    new FunType([INT], INT),
    new FunType([FLOAT], FLOAT),
    new FunType([FLOAT3], FLOAT3),
    new FunType([FLOAT4], FLOAT4),
  ]),

  // Binary operators.
  '+': _GL_BINARY_TYPE,
  '-': _GL_BINARY_TYPE,
  '*': _GL_MUL_TYPE,
  '/': _GL_BINARY_TYPE,
};

const GL_UNIFORM_FUNCTIONS: { [_: string]: string } = {
  "Int": "uniform1i",
  "Int3": "uniform3iv",
  "Int4": "uniform4iv",
  "Float": "uniform1f",
  "Float3": "uniform3fv",
  "Float4": "uniform4fv",
  "Float3x3": "uniformMatrix3fv",
  "Float4x4": "uniformMatrix4fv",
};

// Get a JavaScript variable name for a compiled shader program. Uses the ID
// of the outermost (vertex) shader Prog.
function shadersym(progid: number) {
  return "s" + progid;
}

// Get a JavaScript variable name to hold a shader location. Uses the ID of
// the corresponding escape expression inside the shader.
function locsym(escid: number) {
  return "l" + escid;
}

function get_prog_pair(ir: CompilerIR, progid: number) {
  let vertex_prog = ir.progs[progid];

  // Get the fragment program.
  if (vertex_prog.subprograms.length > 1 ||
      vertex_prog.subprograms.length < 1) {
    throw "error: vertex quote must have exactly one fragment quote";
  }
  let fragment_prog = ir.progs[vertex_prog.subprograms[0]];

  return [vertex_prog, fragment_prog];
}

function emit_shader_setup(ir: CompilerIR, progid: number) {
  let [vertex_prog, fragment_prog] = get_prog_pair(ir, progid);

  // Compile and link the shader program.
  let out = "var " + shadersym(vertex_prog.id) +
    " = get_shader(gl, " +
    progsym(vertex_prog.id) + ", " +
    progsym(fragment_prog.id) + ");\n";

  // Get the variable locations.
  for (let esc of vertex_prog.persist) {
    let [type, _] = ir.type_table[esc.body.id];
    let element_type = _unwrap_array(type);
    let attribute = false;  // As opposed to uniform.
    if (element_type != type) {
      // An array type indicates an attribute.
      attribute = true;
    }

    let func = attribute ? "getAttribLocation" : "getUniformLocation";
    out += "var " + locsym(esc.id) + " = gl." + func + "(" +
      shadersym(vertex_prog.id) + ", " +
      emit_js_string(persistsym(esc.id)) + ");\n";
  }

  return out;
}

function emit_shader_binding(emit: JSCompile, ir: CompilerIR,
    progid: number) {
  let [vertex_prog, fragment_prog] = get_prog_pair(ir, progid);

  // Bind the shader program.
  let out = "gl.useProgram(" + shadersym(vertex_prog.id) + ")";

  // Emit and bind the uniforms.
  for (let esc of vertex_prog.persist) {
    out += ",\n";

    let value = emit(esc.body);
    let [type, _] = ir.type_table[esc.body.id];

    // Primitive types are bound as uniforms.
    if (type instanceof PrimitiveType) {
      let fname = GL_UNIFORM_FUNCTIONS[type.name];
      if (fname === undefined) {
        throw "error: unsupported uniform type " + type.name;
      }

      let is_matrix = fname.indexOf("Matrix") !== -1;
      out += `gl.${fname}(${locsym(esc.id)}`;
      if (is_matrix) {
        // Transpose parameter.
        out += ", false";
      }
      out += `, ${paren(value)})`;

    // Array types are bound as attributes.
    } else if (type instanceof InstanceType && type.cons === ARRAY) {
      let t = type.arg;
      if (t instanceof PrimitiveType) {
        // Call our runtime function to bind the attribute. The parameters are
        // the WebGL context, the attribute location, and the buffer.
        out += "bind_attribute(gl, " +
          locsym(esc.id) + ", " +
          paren(value) + ")";
        // TODO Actually use the type.
      } else {
        throw "error: attributes must be primitive types";
      }

    } else {
      throw "error: persisted values must be primitive or array types";
    }
  }

  return out;
}

// Check for our intrinsics.
function vtx_expr(tree: ExpressionNode) {
  return is_intrinsic_call(tree, "vtx");
}
function render_expr(tree: ExpressionNode) {
  return is_intrinsic_call(tree, "render");
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
          return emit_shader_binding(fself, ir, quote.id);
        } else {
          throw "dynamic `vtx` calls unimplemented";
        }

      // And our intrinsic for indicating the rendering stage.
      } else if (render_expr(tree)) {
        // Just emit the prog (code reference).
        let progid = tree.args[0].id;
        return progsym(progid);
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

  // Compile each program to a string.
  let out = "";
  for (let prog of ir.progs) {
    if (prog !== undefined) {
      // Get the procs to compile.
      let procs: Proc[] = [];
      for (let id of ir.quoted_procs[prog.id]) {
        procs.push(ir.procs[id]);
      }

      let code: string;
      if (prog.annotation === "s") {
        // A shader program.
        code = glsl_compile_prog(_glslcompile, ir, prog.id);
      } else {
        // Ordinary JavaScript quotation.
        code = jscompile_prog(_jscompile, prog, procs);
      }

      out += emit_js_var(progsym(prog.id), code, true) + "\n";
    }
  }

  // Compile each *top-level* proc to a JavaScript function.
  for (let id of ir.toplevel_procs) {
    out += jscompile_proc(_jscompile, ir.procs[id]);
    out += "\n";
  }

  // For each *shader* quotation (i.e., top-level shader quote), generate the
  // setup code.
  let setup_parts: string[] = [];
  for (let prog of ir.progs) {
    if (prog !== undefined) {
      if (prog.annotation === "s" &&
          ir.containing_progs[prog.id] == undefined) {
        setup_parts.push(emit_shader_setup(ir, prog.id));
      }
    }
  }
  let setup_code = setup_parts.join("");

  // Compile the main function.
  let main = jscompile_proc(_jscompile, ir.main);

  // Then wrap it in an outer function that includes the setup code.
  let body = setup_code + "return /* render */ " + main + ";"
  out += emit_js_fun(null, ['gl'], [], body) + "";

  return out;
}
