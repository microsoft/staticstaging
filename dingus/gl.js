"use strict";

var mat4 = require('gl-mat4');
var normals = require('normals');
var canvasOrbitCamera = require('canvas-orbit-camera');
var glContext = require('gl-context');
var pack = require('array-pack-2d');

var bunny = require('bunny');
var teapot = require('teapot');
var snowden = require('snowden');
var dragon = require('stanford-dragon');

function make_buffer(gl, data, type, mode) {
  // Initialize a buffer.
  var buf = gl.createBuffer();

  // Flatten the data to a packed array.
  var arr = pack(data, type);

  // Insert the data into the buffer.
  gl.bindBuffer(mode, buf);
  gl.bufferData(mode, arr, gl.STATIC_DRAW);

  return buf;
}

// Evaluate the compiled SHFL code in the context of the globals we provide as
// externs. Return a setup function that takes no arguments and returns a
// per-frame function.
function shfl_eval(code, gl, projection, view) {
  var dingus = {
    projection: projection,
    view: view,
  };

  // Operations exposed to the language for getting data for meshes.
  function mesh_indices(obj) {
    return make_buffer(gl, obj.cells, 'uint16', gl.ELEMENT_ARRAY_BUFFER);
  }
  function mesh_positions(obj) {
    return make_buffer(gl, obj.positions, 'float32', gl.ARRAY_BUFFER);
  }
  function mesh_normals(obj) {
    var norm = normals.vertexNormals(obj.cells, obj.positions);
    return make_buffer(gl, norm, 'float32', gl.ARRAY_BUFFER);
  }
  function mesh_size(obj) {
    return obj.cells.length * obj.cells[0].length;
  }

  // And, similarly, a function for actually drawing a mesh. This takes the
  // indices buffer for the mesh and its size (in the number of scalars).
  function draw_mesh(indices, size) {
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
    gl.drawElements(gl.TRIANGLES, size, gl.UNSIGNED_SHORT, 0);
  }

  // Evaluate the code, but wrap it in a function to avoid scope pollution.
  return (function () {
    return eval(code);
  })();
}

// Compute a project matrix (placed in the `out` matrix allocation) given the
// width and height of a viewport.
function projection_matrix(out, width, height) {
  var aspectRatio = width / height;
  var fieldOfView = Math.PI / 4;
  var near = 0.01;
  var far  = 100;

  mat4.perspective(out, fieldOfView, aspectRatio, near, far)
}

function start_gl(container, shfl_code) {
  // Create a <canvas> element to do our drawing in. Then set it up to fill
  // the container and resize when the window resizes.
  var canvas = container.appendChild(document.createElement('canvas'));
  function fit() {
    var width = container.clientWidth;
    var height = container.clientHeight;
    canvas.setAttribute('width', width + 'px');
    canvas.setAttribute('height', height + 'px');
  }
  window.addEventListener('resize', fit);
  fit();

  // Attach a `canvas-orbit-camera` thing, which handles user input for
  // manipulating the view.
  var camera = canvasOrbitCamera(canvas);

  // Initialize the OpenGL context with our rendering function.
  var gl = glContext(canvas, render);

  // Create the base matrices to be used
  // when rendering the bunny. Alternatively, can
  // be created using `new Float32Array(16)`
  var projection = mat4.create();
  var view = mat4.create();

  // Execute the compiled SHFL code in context.
  var shfl_program = shfl_eval(shfl_code, gl, projection, view);

  // Invoke the setup stage.
  var shfl_func = shfl_program();

  // TODO Move as much of the following as possible to SHFL land.
  function render() {
    // Get the current size of the canvas.
    var width = gl.drawingBufferWidth;
    var height = gl.drawingBufferHeight;

    // Handle user input and update the resulting camera view matrix.
    camera.view(view);
    camera.tick();

    // Update the projection matrix for translating to 2D screen space.
    projection_matrix(projection, width, height);

    // Draw on the whole canvas.
    gl.viewport(0, 0, width, height);

    // Rendering flags.
    gl.enable(gl.DEPTH_TEST);  // Prevent triangle overlap.
    gl.enable(gl.CULL_FACE);  // Triangles not visible from behind.

    // Invoke the compiled SHFL code.
    shfl_func();
  };
}

module.exports = start_gl;
