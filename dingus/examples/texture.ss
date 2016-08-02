# title: texture
# mode: webgl
# ---

var model = mat4.create();

# Load buffers and parameters for the model.
var mesh = load_obj("teapot.obj");
var position = mesh_positions(mesh);
var normal = mesh_normals(mesh);
var indices = mesh_indices(mesh);
var size = mesh_size(mesh);

var tex = a_texture();

render js<
  vertex glsl<
    gl_Position = projection * view * model * vec4(position, 1.0);
    fragment glsl<
      gl_FragColor = texture2D(tex, vec2(0.0, 0.0));
    >
  >;
  draw_mesh(indices, size);
>
