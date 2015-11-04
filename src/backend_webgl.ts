/// <reference path="util.ts" />
/// <reference path="compile.ts" />
/// <reference path="backend_js.ts" />
/// <reference path="backend_glsl.ts" />

const WEBGL_RUNTIME = `
// Shader management.
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

// WebGL equivalents of GLSL functions.
function vec3(x, y, z) {
  var out = new Float32Array(3);
  out[0] = x || 0.0;
  out[1] = y || 0.0;
  out[2] = z || 0.0;
  return out;
}
`.trim();

const _GL_UNARY_TYPE = new OverloadedType([
  new FunType([INT], INT),
  new FunType([FLOAT], FLOAT),
  new FunType([FLOAT3], FLOAT3),
  new FunType([FLOAT4], FLOAT4),
]);
const _GL_BINARY_TYPE = new OverloadedType([
  new FunType([INT, INT], INT),
  new FunType([FLOAT, FLOAT], FLOAT),
  new FunType([FLOAT3, FLOAT3], FLOAT3),
  new FunType([FLOAT4, FLOAT4], FLOAT4),
  new FunType([FLOAT3X3, FLOAT3X3], FLOAT3X3),
  new FunType([FLOAT4X4, FLOAT4X4], FLOAT4X4),
]);
const _GL_UNARY_BINARY_TYPE = new OverloadedType(
  _GL_UNARY_TYPE.types.concat(_GL_BINARY_TYPE.types)
);
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
  vec4: new OverloadedType([
    new FunType([FLOAT3, FLOAT], FLOAT4),
    new FunType([FLOAT, FLOAT, FLOAT, FLOAT], FLOAT4),
  ]),
  vec3: new OverloadedType([
    new FunType([FLOAT4], FLOAT3),
    new FunType([FLOAT, FLOAT, FLOAT], FLOAT3),
  ]),
  abs: _GL_UNARY_TYPE,
  normalize: _GL_UNARY_TYPE,
  pow: _GL_BINARY_TYPE,
  reflect: _GL_BINARY_TYPE,
  dot: new OverloadedType([
    new FunType([FLOAT3, FLOAT3], FLOAT),
    new FunType([FLOAT4, FLOAT4], FLOAT),
  ]),
  min: _GL_BINARY_TYPE,
  max: _GL_BINARY_TYPE,

  // Binary operators.
  '+': _GL_UNARY_BINARY_TYPE,
  '-': _GL_UNARY_BINARY_TYPE,
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
  // Because of our desugaring approach, all uniforms and attributes will
  // appear as escapes in the vertex quote. If we ever make it possible to
  // jump directly from the fragment stage to the host, we'll need to do some
  // more work here.
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
        // Invoke the render function with its persists as arguments.
        return js_emit_progfunc_call(fself, ir, tree.args[0].id);
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
  let prog_decls = "";
  let proc_decls = "";
  for (let prog of ir.progs) {
    if (prog !== undefined) {
      // Get the procs to compile.
      let procs: Proc[] = [];
      for (let id of ir.quoted_procs[prog.id]) {
        procs.push(ir.procs[id]);
      }

      if (prog.annotation == "r") {
        // Render quote. Compiled as a function.
        proc_decls += js_emit_progfunc(_jscompile, ir, prog.id) + "\n";

      } else {
        // Other quote. Compiled normally.
        let code: string;
        if (prog.annotation === "s") {
          // A shader program.
          code = glsl_compile_prog(_glslcompile, ir, prog.id);
        } else {
          // Ordinary JavaScript quotation.
          code = jscompile_prog(_jscompile, prog, procs);
        }
        prog_decls += emit_js_var(progsym(prog.id), code, true) + "\n";
      }
    }
  }

  // Compile each *top-level* proc, including the main function, to a
  // JavaScript function.
  for (let id of ir.toplevel_procs) {
    proc_decls += jscompile_proc(_jscompile, ir.procs[id]);
    proc_decls += "\n";
  }
  // The result of the wrapper is the main function.
  proc_decls += 'return /* main */ ' + jscompile_proc(_jscompile, ir.main);

  // For each *shader* quotation (i.e., top-level shader quote), generate the
  // setup code.
  let setup_parts: string[] = [];
  for (let prog of ir.progs) {
    if (prog !== undefined) {
      if (prog_kind(ir, prog.id) === ProgKind.vertex) {
        setup_parts.push(emit_shader_setup(ir, prog.id));
      }
    }
  }
  let setup_code = setup_parts.join("");

  // Wrap the shader setup code and the main code together in a function.
  let wrapper = emit_js_fun(null, [], [], setup_code + proc_decls) + '()';

  return prog_decls + wrapper;
}
