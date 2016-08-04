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
      var aoVec = texture2D(aoTex, texcoord);
      var ao = swizzle(aoVec, "x");
      var seam = swizzle(aoVec, "y");

      # Mask (?).
      var mask = texture2D(maskTex, texcoord);
      var blackMix = swizzle(mask, "x");
      var grayMix = swizzle(mask, "y");
      var wearFactor = swizzle(mask, "z") * 0.381;

      # Desaturate the leather color according to the wear factor.
      var wearDesatMin = 0.0;
      var wearDesatMax = 0.0896;
      var wearDesat = mix(wearDesatMin, wearDesatMax, wearFactor);
      var leatherLuminance =
        swizzle(leatherColor, "x") * 0.3 +
        swizzle(leatherColor, "y") * 0.59 +
        swizzle(leatherColor, "z") * 0.11;
      var leatherGray = vec3(leatherLuminance,
                             leatherLuminance,
                             leatherLuminance);
      var desatLeather = mix(vec3(leatherColor), leatherGray, wearDesat);

      # Mix with a wear color.
      var wearColorMin = vec3(1.0, 0.86,0.833);
      var wearColorMax = vec3(0.628,0.584, 0.584);
      var wornLeather = desatLeather * mix(wearColorMin, wearColorMax, wearFactor);

      # Mix with black and then gray according to the mask's x and y channels.
      var darkLeather = mix(vec3(0.0, 0.0, 0.0), wornLeather, blackMix);
      var grayedLeather = mix(darkLeather, vec3(0.823, 0.823, 0.823), grayMix);

      # Mix in a seam color according to the AO texture's y channel.
      var seamColor = vec3(0.522, 0.270, 0.105);
      var leatherWithSeams = mix(grayedLeather, seamColor, seam);

      # Final color composition.
      gl_FragColor = vec4(leatherWithSeams * ao, 1.0);
    >
  >;
  draw_arrays(size);
>
