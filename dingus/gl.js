"use strict";

var fit = require('canvas-fit');
var mat4 = require('gl-mat4');
var normals = require('normals');
var bunny = require('bunny');
var canvasOrbitCamera = require('canvas-orbit-camera');
var glContext = require('gl-context');
var pack = require('array-pack-2d');

function start_gl(container, func) {
  // Create a <canvas> element to do our drawing in. Then set it up to fill
  // the container and resize when the window resizes.
  var canvas = container.appendChild(document.createElement('canvas'));
  window.addEventListener('resize', fit(canvas), false);

  // Attach a `canvas-orbit-camera` thing, which handles user input for
  // manipulating the view.
  var camera = canvasOrbitCamera(canvas);

  // Initialize the OpenGL context with our rendering function.
  var render;
  var gl = glContext(canvas, render);

  // Load the shape data into buffers.
  var bunny_buffers = mesh_buffers(gl, bunny);

  // Create the base matrices to be used
  // when rendering the bunny. Alternatively, can
  // be created using `new Float32Array(16)`
  var projection = mat4.create();
  var model      = mat4.create();
  var view       = mat4.create();

  render = func(gl);
}
