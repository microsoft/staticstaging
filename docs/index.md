title: Alltheworld and SHFL
heading base: 2
script: docs.js
embed: 0
section depth: 1

~Pre:
  class=example

<style>
.example {
  cursor: pointer;
}
.example:hover {
  background: #eee;
}
.madoko p, .madoko li {
  -webkit-hyphens: auto;
  -moz-hyphens: auto;
  -ms-hyphens: auto;
  hyphens: auto;
}
</style>

[TITLE]

This is an example-based introduction to the Alltheworld compiler and its graphics-centric language, SHFL.

# The Basics

Alltheworld has a tiny, imperative core language. You can assign to variables with `var`, do basic arithmetic, and define functions with `def`:

    var g = 9.8;
    def gpe(mass:Float, height:Float)
      mass * height * g;
    gpe(2.0, 3.0)

This program evaluates to around 58.8. (You can click on any of the examples in this document to run them in your browser.)

There's also an ML-esque syntax for defining and invoking functions, which can occasionally be more appropriate:

    var g = 9.8;
    var gpe = fun mass:Float height:Float -> mass * height * g;
    gpe 2.0 3.0

The language can also interoperate with JavaScript. Use `extern` to declare something from JavaScript land:

    extern Math.PI: Float;
    def circumference(radius:Float)
      2.0 * Math.PI * radius;
    circumference(5.0)


# Multi-Stage Programming

Alltheworld, as the name implies, is a [multi-stage programming language][metaml]. This section introduces its constructs for deferring execution (quote), "un-deferring" expressions (escape), and executing deferred code (run).

[metaml]: http://dl.acm.org/citation.cfm?id=259019
[metaocaml]: http://okmij.org/ftp/ML/MetaOCaml.html#implementing-staging
[terra]: http://terralang.org
[jeannie]: http://cs.nyu.edu/rgrimm/papers/oopsla07.pdf
[scala lms]: https://scala-lms.github.io/

## Quote and Run

Angle brackets denote a quote, which defers the execution of some code:

    < 40 + 2 >

A quote produces a code value. Like a closure, a code value is a first-class value representing a computation. To execute a code value, use the `!` operator:

    var code = < 21 * 2 >;
    !code

If you compile that code to JavaScript, you'll see that the quoted code gets compiled to a string literal---it is literally placed in quotation marks. To execute code, the emitted program uses a function called `run`, which is a small wrapper around JavaScript's `eval`.

## Splice

*Splicing* is a defining feature of classic staged languages. You use it to combine quoted code, stitching together pieces into complete programs.

To splice one code value into another, use an *escape* expression, which is denoted by square brackets:

    var a = < 7 * 3 >;
    var b = < [a] * 2 >;
    !b

You can think of `[a]` as invoking a three-step process: First, it *escapes* to the outer context, where `a` is defined. In that context, it evaluates `a` to get the code value `< 7 * 3 >`. Finally, it splices that code into the current quote to produce a code value equivalent to `< (7 * 3) * 2 >`.

If you look at the compiled JavaScript code, you'll see that the second string literal---the one representing the quotation `< [a] * 2 >`---has a placeholder token in it. (As of this writing, the token was `__SPLICE_10__`.) The program uses this along with JavaScript's `string.replace` function to stitch together code at run time before `eval`ing it. The logic for this string manipulation is encapsulated in a runtime function called `splice`.

## Persist

Alltheworld has a second kind of escape expression called a *persist* escape. Rather than splicing together code at run time, persists let you share data between stages. Persist escapes are written with a leading `%` sign:

    var pi = 3.14;
    def calc_area(r:Float)
      < %[pi] * %[r * r] >;
    !calc_area(5.0) + !calc_area(2.0)

Like a splice escape, a persist escape shifts to the context outside of the quote and evaluates an expression. But instead of taking another code value and merging it in, a persist gets an ordinary value---here, plain old numbers---and makes them available inside the quote.

The difference may seem subtle, but it has an important effect on the generated code. This example has two calls to `calc_area` with different values for `r`. If we had used a splice, it would have created and executed two different programs at run time---each with a different number inlined in place of `r`. Instead, the compiled JavaScript only has one string literal in it, and no string splicing occurs at run time.

## Cross-Stage References

Alltheworld includes syntactic niceness for persisting data without explicit escape expressions. In the previous section's example, we performed one multiplication (`r * r`) in the first stage and a second multiplication (by `pi`) in a second stage. If you want to perform both multiplications at the same stage, then you could write `< %[pi] * %[r] * %[r] >`. Alltheworld lets you omit the persist-escape brackets when all you need is a single variable:

    var pi = 3.14;
    def calc_area(r:Float)
      < pi * r * r >;
    !calc_area(5.0) + !calc_area(2.0)

The code inside the quote can pretend that it shares the same variables that are available outside of the quote. The classic literature on multi-stage programming calls this shared-scope effect *cross-stage persistence*, but you can also think of it as syntactic sugar for explicit `%[x]` escapes. In fact, this is how the Alltheworld compiler works: you can see that it generates exactly the same JavaScript code whether you surround `pi` and `r` in persist-escape brackets or not.

## Staging Without Metaprogramming

If you don't use any splicing, quotes can feel very similar to lambdas. A lambda also wraps up code to run later, and via closures, a lambda can also share state from the enclosing scope where it is defined. In fact, it can seem silly that Alltheworld uses string literals and `eval` where an ordinary function would do just fine.

In recognition this correspondence, Alltheworld lets you write quotes that compile to JavaScript functions. They have the same semantics as ordinary `eval`-based quotes---only their implementation, and therefore their performance, differs. To use function stages, you can *annotate* quotes with `f`, like this:

    var x = 21;
    var doubler = f< x + x >;
    !doubler

The JavaScript code that Alltheworld generates for this program doesn't have any string literals at all---and it won't use `eval` at run time.

The compiler needs keeps track of the kinds of programs so it knows how to execute them with `!`. The type system tracks the annotation on each quote. Here's a function that indicates that it takes a function (`f`-annotated) quote:

    def runit(c:f<Int>)
      !c;
    runit(f<2>)

You'll get a type error if the annotations don't match:

    def runit(c:<Int>)
      !c;
    runit(f<2>)


# Graphics { data-mode=webgl }

Alltheworld has a graphics-oriented extension called SHFL, for *shader family language*. In SHFL mode, the compiler targets a combination of JavaScript with WebGL API calls and [GLSL][], the associated low-level shading language.

[glsl]: https://www.opengl.org/documentation/glsl/

## Shader Quotes

The most obvious extension that SHFL adds is quotations that compile to GLSL shader code. Recall that we previously *annotated* quotes with `f` to make the compiler emit them as JavaScript functions; a new annotation, `s`, switches to emit them as shader programs.

SHFL also has a couple of intrinsic functions, `vtx` and `frag`, to indicate vertex and fragment shaders. A fragment-shader quote is contained within a vertex-shader quote because it's a later stage. Here's a useless SHFL program:

    vtx s< frag s< 1.0 > >

Take a look at the compiler's output. You'll see two string literals in the final JavaScript, both of which contain a `void main() {...}` declaration that characterizes them as GLSL shader programs.

## Render, Vertex, Fragment

SHFL programs use three kinds of stages. We've already seen two: the vertex shader stage and the fragment shader stage. Both of thee run on the GPU. The third stage is the *render loop* stage, which distinguishes code that runs on the CPU for every frame from code that runs once at setup time.

The render stage needs to be a function quote (annotated with `f`), and you pass it to an intrinsic function called `render` to register it as the render-loop code. Inside the vertex and fragment shader stages, your job is to assign to the intrinsic variables `gl_Position` and `gl_FragColor` respectively. In the initial setup stage, there are also intrinsics to load a few built-in sample model assets. Here's a tiny example that uses all of the SHFL stages:

    # Load the mesh data for a sample model.
    var mesh = teapot;
    var position = mesh_positions(mesh);
    var indices = mesh_indices(mesh);
    var size = mesh_size(mesh);

    # Initialize a model matrix for the object.
    var model = mat4.create();

    render f<
      # Bind the vertex and fragment shaders.
      vtx s<
        # Compute the final position of the model's vertex.
        # The `projection` # and `view` matrices are provided
        # by the runtime context.
        gl_Position = projection * view * model * vec4(position, 1.0);

        frag s<
          # Use a solid color.
          gl_FragColor = vec4(0.5, 0.3, 0.7, 1.0);
        >
      >;

      # Draw the model with the above bound shader.
      draw_mesh(indices, size);
    >

There's a lot going on even in this small example. The next two sections will introduce the graphics-specific intrinsics that the example uses and the way data is shared between the stages. Then, we'll move on to more interesting graphics.

## WebGL and GLSL Intrinsics

## Attributes and Uniforms

## Reusable Shaders


# Loose Ends

- parse errors are terrible
- type errors don't show you where in the source
- `if`, `while`, `for`
- binding intrinsics to worlds
- separately bind shader code and parameters
