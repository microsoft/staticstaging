---
title: Happy Graphics Coding with Static Staging
abstract: |
    Graphics programming should be fun.
    But today, you have to choose between pre-packaged engines like Unity and low-level nitty-gritty APIs like OpenGL and Direct3D.
    If you want to control the GPU directly with shaders, you're in for a steep learning curve.

    *Static staging* is a new programming language concept from [Microsoft Research][msr] that makes it easy to program across the CPU--GPU boundary. The [Static Staging Compiler][ssc] is an open-source prorotype compiler that generates [WebGL][] and [GLSL][] code from a single program with *staging annotations*.

    [msr]: http://research.microsoft.com
    [ssc]: https://github.com/Microsoft/staticstaging
    [webgl]: https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API
    [glsl]: https://www.opengl.org/documentation/glsl/
---
More intro text.

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
       gl_FragColor = vec4(abs(normal), 1.0);
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
