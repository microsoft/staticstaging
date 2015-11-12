"use strict";

var mat4 = require('gl-mat4');
var normals = require('normals');
var canvasOrbitCamera = require('canvas-orbit-camera');
var pack = require('array-pack-2d');
var eye = require('eye-vector');

var bunny = require('bunny');
var teapot = require('teapot');
var snowden = require('snowden');

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

// Set up a canvas inside a container element. Return a function that sets the
// render function (given compiled SHFL code as a string).
function start_gl(container, fps_element) {
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
  var gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");

  // Create the base matrices to be used
  // when rendering the bunny. Alternatively, can
  // be created using `new Float32Array(16)`
  var projection = mat4.create();
  var view = mat4.create();

  // Bookkeeping for calculating framerate.
  var frame_count = 0;
  var last_sample = new Date();
  var sample_rate = 1000;

  // Initially, the SHFL function does nothing. The client needs to call us
  // back to fill in the function. Then, we will update this variable.
  var shfl_render = null;

  // The main render loop.
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

    // Invoke the compiled SHFL code.
    if (shfl_render) {
      shfl_render.proc.apply(void 0, shfl_render.env);
    }

    // Framerate tracking.
    ++frame_count;
    var now = new Date();
    var elapsed = now - last_sample;  // Milliseconds.
    if (elapsed > sample_rate) {
      var fps = frame_count / elapsed * 1000;
      if (fps_element) {
        fps_element.textContent = fps.toFixed(2);
      } else {
        console.log(fps + " fps");
      }

      last_sample = now;
      frame_count = 0;
    }

    // Ask to be run again.
    window.requestAnimationFrame(render);
  };

  // Request that the render function get called in the browser's render loop.
  window.requestAnimationFrame(render);

  // Return a function that lets the client update the render body.
  return function (shfl_code) {
    // Execute the compiled SHFL code in context.
    var shfl_program = shfl_eval(shfl_code, gl, projection, view);

    // Invoke the setup stage.
    shfl_render = shfl_program();
  };
}

module.exports = start_gl;
