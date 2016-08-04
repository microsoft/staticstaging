# title: couch
# mode: webgl
# ---

# Position the model.
var model = mat4.create();
mat4.scale(model, model, vec3(0.35, 0.35, 0.35));
mat4.rotateX(model, model, 0.4);
mat4.rotateY(model, model, 1.2);
mat4.rotateZ(model, model, 0.5);

# Load buffers and parameters for the model.
var mesh = load_raw("couch/couch.vtx.raw");
var position = mesh_positions(mesh);
var normal = mesh_normals(mesh);
var size = mesh_count(mesh);
var texcoord = mesh_texcoords(mesh);

# Repeating leather texture.
var leatherTex = load_texture("couch/T_Leather_D.png");
# Ambient occlusion (AO) texture for highlighting.
var aoTex = load_texture("couch/T_Couch_AO.png");
# Mask (?).
var maskTex = load_texture("couch/T_Couch_Mask.png");

render js<
  vertex glsl<
    gl_Position = projection * view * model * vec4(position, 1.0);
    fragment glsl<
      # The leather texture repeats more quickly than
      # the per-couch textures.
      var leatherTexCoord = texcoord * 5.79;
      var leatherColor = texture2D(leatherTex, leatherTexCoord);

      # Look up the ambient occlusion amount.
      var ao = swizzle(texture2D(aoTex, texcoord), "x");

      # Mask (?).
      var mask = texture2D(maskTex, texcoord);
      var maskx = swizzle(mask, "x");
      var masky = swizzle(mask, "y");
      var maskz = swizzle(mask, "z");

      # Final color composition.
      gl_FragColor = leatherColor * ao;
    >
  >;
  draw_arrays(size);
>
