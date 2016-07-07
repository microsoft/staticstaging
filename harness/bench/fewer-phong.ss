# title: lots of objects + phong
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

# Phong shader.
def phong(pos: Float3 Array, norm: Float3 Array, model: Mat4, lightpos: Vec3, color: Vec3, specular: Float) (
  var camera_pos = eye(view);

  vertex glsl<
    gl_Position = projection * view * model * vec4(pos, 1.0);

    fragment glsl<
      # Convert to world space.
      var position_world = vec3(model * vec4(pos, 1.0));
      var normal_world = normalize(vec3(model * vec4(pos, 0.0)));
      var view_dir_world = normalize(camera_pos - position_world);

      # Light.
      var light_direction = normalize(lightpos - position_world);

      # Diffuse.
      var ndl = vec3( max(0.0, dot(normal_world, light_direction)) );

      # Specular.
      var angle = normalize(view_dir_world + light_direction);
      var spec_comp_b = max(0.0, dot(normal_world, angle));
      var spec_comp = pow( spec_comp_b, max(1.0, specular) ) * 2.0;

      gl_FragColor = vec4(color * ndl + vec3(spec_comp), 1.0);
    >
  >;
);

# The parameters for the Phong shader.
var specular = 50.0;
var light_color = vec3(1.0, 0.2, 0.5);

render js<
  var t = Date.now();
  var light_position = vec3(
    Math.cos(t / 200) * 40.0,
    0.0,
    Math.sin(t / 200) * 40.0
  );

  grid(5, fun x:Int y:Int z:Int -> (
    var model = mat4.create();
    var pos = vec3(
      (x - 5) * 10,
      (y - 5) * 10,
      (z - 5) * 10
    );
    mat4.translate(model, id, pos);
    mat4.translate(model, model, vec3(0.0, 3.0, -4.0));
    phong(position, normal, model, light_position, light_color, specular);
    draw_mesh(indices, size);
  ))
>
