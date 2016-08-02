# title: texture
# mode: webgl
# ---

# Scale the model up.
var model = mat4.create();
mat4.scale(model, model, vec3(50.0, 50.0, 50.0));

# Load buffers and parameters for the model.
var mesh = load_obj("head.obj");
var position = mesh_positions(mesh);
var normal = mesh_normals(mesh);
var indices = mesh_indices(mesh);
var size = mesh_size(mesh);
var texcoord = mesh_texcoords(mesh);

# Load a texture from an image.
var tex = load_texture("lambertian.jpg");

# Identity and rotation matrix.
var id = mat4.create();
var rot = mat4.create();

render js<
  # Rotate the identity matrix.
  var phase = Date.now() / 1000;
  mat4.rotateY(rot, id, phase);

  vertex glsl<
    gl_Position = projection * view * %[ model * rot ] * vec4(position, 1.0);
    fragment glsl<
      gl_FragColor = texture2D(tex, vec2(0.0, 0.0));
    >
  >;
  draw_mesh(indices, size);
>
