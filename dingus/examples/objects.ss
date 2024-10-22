# title: two objects
# mode: webgl
# ---

var id = mat4.create();

# Bunny model.
var b_position = mesh_positions(bunny);
var b_normal = mesh_normals(bunny);
var b_indices = mesh_indices(bunny);
var b_size = mesh_size(bunny);
var b_model = mat4.create();

# Teapot model.
var t_position = mesh_positions(teapot);
var t_normal = mesh_normals(teapot);
var t_indices = mesh_indices(teapot);
var t_size = mesh_size(teapot);
var t_model = mat4.create();

def simple_shader(pos: Float3 Array, norm: Float3 Array, model: Mat4) (
  vertex glsl<
    gl_Position = projection * view * model * vec4(pos, 1.0);
    fragment glsl<
      gl_FragColor = vec4(abs(norm), 1.0);
    >
  >;
);

render js<
  var phase = Math.sin(Date.now() / 200);
  mat4.rotateX(b_model, id, phase);
  mat4.rotateZ(t_model, id, phase);
  mat4.rotateX(t_model, t_model, phase * 2);

  simple_shader(b_position, b_normal, b_model);
  draw_mesh(b_indices, b_size);

  simple_shader(t_position, t_normal, t_model);
  draw_mesh(t_indices, t_size);
>
