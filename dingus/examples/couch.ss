# title: couch
# mode: webgl
# ---

var model = mat4.create();

# Load buffers and parameters for the model.
var mesh = load_raw("couch.vtx.raw");
var position = mesh_positions(mesh);
var normal = mesh_normals(mesh);
var size = mesh_size(mesh);
var texcoord = mesh_texcoords(mesh);

# Load a texture from an image.
var tex = load_texture("default.png");

render js<
  vertex glsl<
    gl_Position = projection * view * model * vec4(position, 1.0);
    fragment glsl<
      gl_FragColor = texture2D(tex, texcoord);
    >
  >;
  draw_arrays(size);
>
