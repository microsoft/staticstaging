"use strict";

var fit = require('canvas-fit');
var mat4 = require('gl-mat4');
var normals = require('normals');
var bunny = require('bunny');
var teapot = require('teapot');
var canvasOrbitCamera = require('canvas-orbit-camera');
var glContext = require('gl-context');
var pack = require('array-pack-2d');

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

// TODO Remove this.
// Given a mesh, with the fields `positions` and `cells`, create three buffers
// for drawing the thing. Return an object with the fields:
// - `cells`, a 3-dimensional uint16 element array buffer
// - `positions`, a 3-dimensional float32 array buffer
// - `normals`, ditto
function mesh_buffers(gl, obj) {
  var norm = normals.vertexNormals(obj.cells, obj.positions);

  return {
    cells: make_buffer(gl, obj.cells, 'uint16', gl.ELEMENT_ARRAY_BUFFER),
    positions: make_buffer(gl, obj.positions, 'float32', gl.ARRAY_BUFFER),
    normals: make_buffer(gl, norm, 'float32', gl.ARRAY_BUFFER),
  }
}

// Operations exposed to the language for getting data for meshes. These are
// curried so that the compiler can pass the `gl` parameter without exposing it
// to the program.
function mesh_indices(gl) {
  return function(obj) {
    return make_buffer(gl, obj.cells, 'uint16', gl.ELEMENT_ARRAY_BUFFER);
  }
}
function mesh_positions(gl) {
  return function(obj) {
    return make_buffer(gl, obj.positions, 'float32', gl.ARRAY_BUFFER);
  }
}
function mesh_normals(gl) {
  return function(obj) {
    var norm = normals.vertexNormals(obj.cells, obj.positions);
    return make_buffer(gl, norm, 'float32', gl.ARRAY_BUFFER);
  }
}
function mesh_size(gl) {
  return function(obj) {
    return obj.cells.length * obj.cells[0].length;
  }
}

// And, similarly, a function for actually drawing a mesh. This takes the
// indices buffer for the mesh and its size (in numbers).
function draw_mesh(gl) {
  return function(indices, size) {
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
    gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
  }
}

// Set a buffer as the element array.
function bind_element_buffer(gl, buffer) {
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
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

// A convenience wrapper for binding elements and drawing them. Takes a cells
// buffer as its argument.
function draw_mesh(gl, obj, cells) {
  bind_element_buffer(gl, cells);

  var count = obj.cells.length * obj.cells[0].length;
  gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
}

function start_gl(container, func) {
  // Create a <canvas> element to do our drawing in. Then set it up to fill
  // the container and resize when the window resizes.
  var canvas = container.appendChild(document.createElement('canvas'));
  window.addEventListener('resize', fit(canvas), false);

  // Attach a `canvas-orbit-camera` thing, which handles user input for
  // manipulating the view.
  var camera = canvasOrbitCamera(canvas);

  // Initialize the OpenGL context with our rendering function.
  var gl = glContext(canvas, render);

  // Load the shape data into buffers.
  var bunny_buffers = mesh_buffers(gl, bunny);
  var teapot_buffers = mesh_buffers(gl, teapot);

  // Create the base matrices to be used
  // when rendering the bunny. Alternatively, can
  // be created using `new Float32Array(16)`
  var projection = mat4.create();
  var model = mat4.create();
  var view = mat4.create();

  // Invoke the setup stage to get a function for the render stage.
  // TODO It would sure be nice to get rid of this communication through
  // globals!
  window.dingus = {
    projection: projection,
    model: model,
    view: view,
  };
  window.bunny = bunny_buffers;
  window.teapot = teapot_buffers;
  var shfl_func = func(gl);

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

    // Draw the model!
    draw_mesh(gl, bunny, bunny_buffers.cells);
  };
}

module.exports = start_gl;
