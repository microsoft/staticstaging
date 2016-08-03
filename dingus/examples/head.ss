# title: head
# mode: webgl
# ---

# This example renders a textured model. The head model
# and its texture are from the Computer Graphics Archive
# at Williams:
# http://graphics.cs.williams.edu/data/meshes.xml

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
      # For some reason, the texture is given "upside
      # down." So we invert the Y coordinate in the
      # texture lookup.
      var coord = vec2(swizzle(texcoord, "x"),
                       4096.0 - swizzle(texcoord, "y"));
      gl_FragColor = texture2D(tex, coord);
    >
  >;
  draw_mesh(indices, size);
>
