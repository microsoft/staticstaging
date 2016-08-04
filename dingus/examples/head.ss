# title: head
# mode: webgl
# ---

# This example renders a textured model. The head model
# and its texture are from the Computer Graphics Archive
# at Williams:
# http://graphics.cs.williams.edu/data/meshes.xml

# Scale the model up.
var model_base = mat4.create();
mat4.scale(model_base, model_base, vec3(50.0, 50.0, 50.0));

# Load buffers and parameters for the model.
var mesh = load_obj("head.obj");
var position = mesh_positions(mesh);
var indices = mesh_indices(mesh);
var normal = mesh_normals(mesh);
var size = mesh_size(mesh);
var texcoord = mesh_texcoords(mesh);

# Load the color texture and bump map texture.
var tex = load_texture("lambertian.jpg");
var bumpTex = load_texture("bump-lowRes.png");

# Rotated model matrix.
var model = mat4.create();

render js<
  # Rotate the model matrix.
  var phase = Date.now() / 1000;
  mat4.rotateY(model, model_base, phase);

  # Set up for lighting.
  var camera_pos = eye(view);
  var lightpos = vec3(-40.0, 40.0, 30.0);
  var lightcolor = vec3(0.9, 0.8, 0.8);
  var specular = 1.0;

  vertex glsl<
    gl_Position = projection * view * model * vec4(position, 1.0);
    fragment glsl<
      # Look up the surface color from a texture.
      var color = vec3(texture2D(tex, texcoord));

      # TODO EXPERIMENTAL Bump mapping.
      var bumpHeight = swizzle(texture2D(bumpTex, texcoord), "x");

      # TODO Approximate the derivative.
      var delta = 1.0 / 1024.0;
      var bMd = swizzle(texture2D(bumpTex, texcoord), "x");
      var bUp = swizzle(texture2D(bumpTex, texcoord + vec2(0.0, delta)), "x");
      var bRt = swizzle(texture2D(bumpTex, texcoord + vec2(delta, 0.0)), "x");
      var bumpNormal = normalize(vec3(bUp - bMd, bRt - bMd, 0.01));

      # Phong lighting.
      var position_world = vec3(model * vec4(position, 1.0));
      var normal_world = normalize(vec3(model * vec4(normal, 0.0)));
      var view_dir_world = normalize(camera_pos - position_world);
      var light_direction = normalize(lightpos - position_world);
      var ndl = vec3( max(0.0, dot(normal_world, light_direction)) );
      var angle = normalize(view_dir_world + light_direction);
      var spec_comp_b = max(0.0, dot(normal_world, angle));
      var spec_comp = pow( spec_comp_b, max(1.0, specular) ) * 2.0;

      # Compose the light with the base color.
      var lit = lightcolor * (color * (ndl + 0.7) +
        color * spec_comp);

      gl_FragColor = vec4(color, 1.0);
    >
  >;
  draw_mesh(indices, size);
>
