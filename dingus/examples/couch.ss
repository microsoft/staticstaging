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

# Load a texture from an image.
var tex = load_texture("couch/T_Leather_D.png");

render js<
  vertex glsl<
    gl_Position = projection * view * model * vec4(position, 1.0);
    fragment glsl<
      gl_FragColor = texture2D(tex, texcoord);
    >
  >;
  draw_arrays(size);
>
