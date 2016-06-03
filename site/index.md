---
title: Happy Shader Programming with Static Staging
---
An introduction goes here.

## Let's Draw Something

An example here.

    # Position the model.
    var model = mat4.create();
    mat4.scale(model, model, vec3(2.0, 2.0, 2.0));
    mat4.translate(model, model, vec3(0.0, -2.0, 0.0));

    # Load buffers and parameters for the model.
    var mesh = bunny;
    var position = mesh_positions(mesh);
    var normal = mesh_normals(mesh);
    var indices = mesh_indices(mesh);
    var size = mesh_size(mesh);

    # ---

    render js<
     vertex glsl<
      gl_Position = projection * view * model *
       vec4(position, 1.0);
      fragment glsl<
       gl_FragColor =
        vec4(abs(normal), 1.0);
      >
     >;
     draw_mesh(indices, size);
    >

More text goes here.

## Another Example

We can use as many examples as we want!

    var model = mat4.create();

    # Load buffers and parameters for the model.
    var mesh = bunny;
    var position = mesh_positions(mesh);
    var normal = mesh_normals(mesh);
    var indices = mesh_indices(mesh);
    var size = mesh_size(mesh);

    # ---

    render js<
     vertex glsl<
      gl_Position = projection * view *
       vec4(position, 1.0);
      fragment glsl<
       gl_FragColor =
        vec4(0.3, 0.1, 0.9, 1.0);
      >
     >;
     draw_mesh(indices, size);
    >
