# title: lots of objects
# mode: webgl
# ---

var id = mat4.create();

# Load buffers and parameters for the model.
var mesh = bunny;
var position = mesh_positions(mesh);
var normal = mesh_normals(mesh);
var indices = mesh_indices(mesh);
var size = mesh_size(mesh);

# A triply-nested loop to draw lots of objects in a grid.
def grid(count: Int, f:(Int Int Int -> Void)) (
  var x = count;
  while (x) (
    x = x - 1;
    var y = count;
    while (y) (
      y = y - 1;
      var z = count;
      while (z) (
        z = z - 1;
        f(x, y, z);
      )
    )
  )
);

# World's simplest shader.
def shade(model: Mat4) (
  vertex glsl<
    gl_Position = projection * view * model * vec4(position, 1.0);
    fragment glsl<
      gl_FragColor = vec4(abs(normal), 1.0);
    >
  >
);

render js<
  grid(10, fun x:Int y:Int z:Int -> (
    var model = mat4.create();
    var pos = vec3(
      (x - 5) * 10,
      (y - 5) * 10,
      (z - 5) * 10
    );
    mat4.translate(model, id, pos);
    shade(model);
    draw_mesh(indices, size);
  ))
>
