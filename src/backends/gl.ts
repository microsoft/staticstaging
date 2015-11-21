/// <reference path="../type.ts" />
/// <reference path="../ast.ts" />
/// <reference path="../compile/ir.ts" />
/// <reference path="emitutil.ts" />

// General OpenGL-related backend components.
module Backends.GL {

// Special GLSL matrix and vector types.
// Someday, a more structured notion of generic vector and matrix types would
// be better. For now, we just support a handful of common types.
export const FLOAT3 = new PrimitiveType("Float3");
export const FLOAT4 = new PrimitiveType("Float4");
export const FLOAT3X3 = new PrimitiveType("Float3x3");
export const FLOAT4X4 = new PrimitiveType("Float4x4");
export const ARRAY = new ConstructorType("Array");
export const INT3 = new PrimitiveType("Int3");
export const INT4 = new PrimitiveType("Int4");

export const GL_TYPES: TypeMap = {
  "Float3": FLOAT3,
  "Float4": FLOAT4,
  "Vec3": FLOAT3,  // Convenient OpenGL-esque names.
  "Vec4": FLOAT4,
  "Float3x3": FLOAT3X3,
  "Float4x4": FLOAT4X4,
  "Mat3": FLOAT3X3,
  "Mat4": FLOAT4X4,
  "Int3": INT3,
  "Int4": INT4,
  "Array": ARRAY,

  // TODO This Mesh type is used by the dingus. It is an opaque type. It would
  // be nice if the dingus could declare the Mesh type itself rather than
  // needing to bake it in here.
  "Mesh": new PrimitiveType("Mesh"),
};

export const NUMERIC_TYPES: Type[] = [
  FLOAT3, FLOAT4,
  FLOAT3X3, FLOAT4X4,
  INT3, INT4,
];

export const TYPE_NAMES: { [_: string]: string } = {
  "Int": "int",
  "Int3": "ivec3",
  "Int4": "ivec4",
  "Float": "float",
  "Float3": "vec3",
  "Float4": "vec4",
  "Float3x3": "mat3",
  "Float4x4": "mat4",
};

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
export const INTRINSICS: TypeMap = {
  render: new FunType([new CodeType(ANY, "f")], VOID),
  vtx: new FunType([new CodeType(ANY, "s")], VOID),
  frag: new FunType([new CodeType(ANY, "s")], VOID),
  gl_Position: FLOAT4,
  gl_FragColor: FLOAT4,
  vec4: new OverloadedType([
    new FunType([FLOAT3, FLOAT], FLOAT4),
    new FunType([FLOAT, FLOAT, FLOAT, FLOAT], FLOAT4),
    new FunType([FLOAT], FLOAT4),
  ]),
  vec3: new OverloadedType([
    new FunType([FLOAT4], FLOAT3),
    new FunType([FLOAT, FLOAT, FLOAT], FLOAT3),
    new FunType([FLOAT], FLOAT3),
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

export function frag_expr(tree: ExpressionNode) {
  return is_intrinsic_call(tree, "frag");
}

export function vtx_expr(tree: ExpressionNode) {
  return is_intrinsic_call(tree, "vtx");
}

export function render_expr(tree: ExpressionNode) {
  return is_intrinsic_call(tree, "render");
}


// Determine the stage kind of a Prog: render, vertex, or fragment. Uses these
// definitions, which are based on containment and annotations:
// - A fragment program is a shader program contained in another shader
//   program.
// - A vertex program is a shader program that is either not nested in any
//   other program or whose containing program is a function program.
// - A render program is any function program.
// - Anything else is an ordinary program.
export enum ProgKind {
  ordinary,
  render,
  vertex,
  fragment,
}
export function prog_kind(ir: CompilerIR, progid: number): ProgKind {
  let prog = ir.progs[progid];
  if (prog.annotation === "f") {
    return ProgKind.render;
  } else if (prog.annotation === "s") {
    if (prog.quote_parent === null) {
      return ProgKind.vertex;
    }
    let parprog = ir.progs[prog.quote_parent];
    if (parprog.annotation === "f") {
      return ProgKind.vertex;
    } else {
      return ProgKind.fragment;
    }
  } else {
    return ProgKind.ordinary;
  }
}


// The logic for determining which stage communicates to which other stage and
// how. Each Glue value abstracts over (and contains the information necessary
// to emit) these pieces of glue:
// - GLSL attribute/varying/uniform declarations.
// - Assignments to pass data from one GLSL program to the next.
// - WebGL's location API (setup time).
// - WebGL's binding calls (render time).

// Check whether a scope is a render/ordinary quote or the main, top-level
// program.
export function _is_cpu_scope(ir: CompilerIR, progid: number) {
  if (progid === null) {
    return true;
  }

  let defining_kind = prog_kind(ir, progid);
  return defining_kind === ProgKind.render ||
         defining_kind === ProgKind.ordinary;
}

// A naming convention for global communication (uniform/attribute/varying)
// variables in shaders. The `scopeid` is the ID of the quote where the
// variable is used. `exprid` is the ID of the variable or persist scape
// expression.
export function shadervarsym(scopeid: number, varid: number) {
  return "s" + scopeid + "v" + varid;
}

// Check whether the type of a value implies that it needs to be passed as an
// attribute: i.e., it is an array type.
export function _attribute_type(t: Type) {
  if (t instanceof InstanceType) {
    return t.cons === ARRAY;
  }
  return false;
}

// A helper function that unwraps array types. Non-array types are unaffected.
export function _unwrap_array(t: Type): Type {
  if (t instanceof InstanceType) {
    if (t.cons === ARRAY) {
      // Get the inner type: the array element type.
      return t.arg;
    }
  }
  return t;
}

// Represents a single value as it is communicated *into* a stage.
export interface Glue {
  // Uniquely identify the original value.
  id: number,

  // The GLSL variable name that stores the value as used in this stage.
  name: string,

  // The type of the value as it appears in the GLSL program.
  type: Type,

  // The value is either an expression (for escapes) or just another variable
  // name to carry through (for free variables). Only one of these may be
  // set.
  value_expr?: ExpressionNode,
  value_name?: string,

  // Whether this variable comes from the host directly (a WebGL binding) or
  // from a previous shader stage (a `varying` variable).
  from_host: boolean,

  // Whether this is the point where the value decays from a `T Array` to a
  // plain old `T`. This occurs only at the first shader stage.
  attribute: boolean,
}

// Find all the incoming Glue values for a given shader program.
export function get_glue(ir: CompilerIR, prog: Prog): Glue[] {
  let glue: Glue[] = [];

  // Get glue for the persists.
  for (let esc of prog.persist) {
    let [type,] = ir.type_table[esc.body.id];
    let g: Glue = {
      id: esc.id,
      name: shadervarsym(prog.id, esc.id),
      type: _unwrap_array(type),
      from_host: _is_cpu_scope(ir, nearest_quote(ir, esc.body.id)),
      attribute: false,
    };

    if (_attribute_type(type)) {
      // The original value was an attribute. We either compute the value (if
      // we're the owner) or we drag through the decayed value.
      if (esc.prog === prog.id) {
        // We own the escape. (This can only happen at the outermost shader
        // stage for attributes.) Compute the value on the CPU and consume it.
        g.value_expr = prog.body;
        g.attribute = true;
      } else {
        // We do not own the escape, so it is not computed. Instead, just get
        // the value from the previous shader stage.
        g.value_name = shadervarsym(prog.parent, esc.id);
        g.from_host = false;
      }

    } else if (esc.prog === prog.id) {
      // A uniform or varying whose value is produced here.
      g.value_expr = esc.body;

    } else if (!g.from_host) {
      // A varying produced by a previous shader stage.
      g.value_name = shadervarsym(prog.parent, esc.id);

    } else {
      // Neither owned nor passed through. This is not glue for this stage.
      continue;
    }

    glue.push(g);
  }

  // Get glue for the free variables.
  for (let fv of prog.free) {
    let [type,] = ir.type_table[fv];
    let g: Glue = {
      id: fv,
      name: shadervarsym(prog.id, fv),
      type: _unwrap_array(type),
      from_host: _is_cpu_scope(ir, nearest_quote(ir, fv)),
      attribute: false,
    };

    if (_attribute_type(type)) {
      console.log(prog, prog.parent);
      // An attribute, originally.
      if (_is_cpu_scope(ir, nearest_quote(ir, prog.parent))) {
        // As above, the variable is defined in the containing program. The
        // array-to-element decay occurs here.
        g.value_name = varsym(fv);
        g.attribute = true;
      } else {
        // The value has already decayed; just get its value from the parent.
        g.value_name = shadervarsym(prog.parent, fv);
        g.from_host = false;
      }

    } else if (g.from_host) {
      // A uniform. Uniforms only need to be *bound* for the top-level shader,
      // then they are available for free when they are declared with the same
      // name in other shaders.
      g.name = varsym(fv);
      if (_is_cpu_scope(ir, nearest_quote(ir, prog.parent))) {
        // Get the value from the host.
        g.value_name = varsym(fv);
      }

    } else {
      // A varying (produced at an earlier shader stage). Get the variable
      // from the previous stage.
      g.value_name = shadervarsym(prog.parent, fv);
    }

    glue.push(g);
  }

  return glue;
}

}
