title: Alltheworld and SHFL
heading base: 2
script: docs.js
embed: 0

.pre-indented:
  class=example

<style>
.example {
  cursor: pointer;
}
.example:hover {
  background: #eee;
}
</style>

[TITLE]

This is an example-based introduction to the Alltheworld compiler and its graphics-centric language, SHFL.

# The Basics

Alltheworld has a tiny, imperative core language. You can assign to variables with `var`, do basic arithmetic, write lambdas with `fun`, and apply them ML-style:

    var g = 9.8;
    var gpe = fun mass:Float height:Float -> mass * height * g;
    gpe 2.0 3.0

This program evaluates to around 58.8. (You can click on any of the examples in this document to run them in your browser.)

There's also an alternative Python-esque syntax for defining and invoking functions, which can be more readable:

    var g = 9.8;
    def gpe(mass:Float, height:Float)
      mass * height * g;
    gpe(2.0, 3.0)

The language can also interoperate with JavaScript. Use `extern` to declare something from JavaScript land:

    extern Math.PI: Float;
    def circumference(radius:Float)
      2.0 * Math.PI * radius;
    circumference(5.0)


# Multi-Stage Programming

## Quote and Run

## Splice

## Persist

## Cross-Stage References

## Staging Without Metaprogramming


# Graphics

## Render, Vertex, Fragment

## WebGL and GLSL Intrinsics

## Attributes and Uniforms

## Reusable Shaders
