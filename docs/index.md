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

# The Basics { #basics }

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

## N-Level Escapes

Alltheworld generalizes escapes to move across multiple stages at once. You can write a number after a splice `[e]` or persist `%[e]` escape to indicate the number of stages to look through:

    var c = <5>;
    !< 2 + !< 8 * [c]2 > >

The escape `[c]2` gets the value to splice from *two* levels up---where `c` is defined---rather than just shifting to the immediately containing quote. (The syntax is intended to call to mind a subscript in math, as in $[ e ]_2$.)

At first glance, it might look like `[e]n` or `%[e]n` is just syntactic sugar for $n$ nested escapes, like `[[e]]` or `%[%[e]]`. This is close to true semantically, but as with cross-stage references and program quotes, the differences are in performance.

Take another look at the splicing example above. It uses a form like `< ... < [e]2 > ... >` to splice code from the main stage *directly* into a nested program. That is, the expression $e$ is evaluated when the outer quote expression is evaluated, and the resulting program should do *no further splicing* when it is executed. In other words, if we inspect the program that the splice generates:

    var c = <5>;
    < 2 + !< 8 * [c]2 > >

we'll see a splice-free nested program, `< 2 + !< 8 * 5 > >`. (You may need to switch the tool's mode to "interpreter" to see this pretty-printed code.) That's in contrast to this similar program that uses nested splices:

    var c = <<5>>;
    < 2 + !< 8 * [[c]] > >

which produces `< 2 + !< 8 * [<5>] > >`, a program that will splice the number 5 into the inner quote when it eventually executes. Nesting a persist inside a splice, as in `[%[c]]`, has a similar drawback. In fact, it is impossible to implement $n$-level escapes as syntactic sugar: they are required to splice directly into nested quotes. We'll also see below that they model certain CPU--GPU communication channels that can skip stages.


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

**TK: Start with a simpler example (no mesh).**

## WebGL and GLSL Intrinsics

SHFL gives you access to parts of the [WebGL API][webgl] for host-side code and [GLSL built-ins][glsl ref] in shader code. It also provides several handy higher-level operations from libraries that extend the WebGL basics. All of these are exposed using [`extern`s][#basics] in a standard preamble. You can see the definitive list in [the source code for this preamble][preamble]. Here are a few important intrinsics you'll need:

[preamble]: https://github.com/sampsyo/alltheworld/blob/master/dingus/gl_preamble.atw

* `teapot`, `bunny`, and `snowden`: `Mesh`. Sample object assets.
* `mesh_positions`: `Mesh -> Float3 Array`. Get the vertex positions from a mesh. Under the hood, a `Float3 Array` is implemented as a WebGL buffer.
* `mesh_indices`: `Mesh -> Int3 Array`. Get the triangle vertex indices for a mesh.
* `mesh_size`: `Mesh -> Int`. Get the size (in triangles) of a mesh.
* `draw_mesh`: `(Int3 Array) Int -> Void`. Draw an object given its index array and the length of the array using the currently bound shader. Uses [`gl.drawElements`][drawelements] under the hood.
* `projection` and `view`: `Float4x4`. Transform matrices corresponding to the viewer's canvas shape and camera position.

These intrinsics use matrix and vector types such as `Float4` (a 4-element float vector) and `Int3x3` (a 3-by-3 matrix of integers). We provide aliases to make these comfortable for people coming from Direct3D and HLSL (`Float3` and `Float3x3`) and from OpenGL (`Vec3` and `Mat4`). These alternate names can be used interchangeably.

[drawelements]: https://msdn.microsoft.com/en-us/library/dn302396(v=vs.85).aspx
[webgl]: https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API
[glsl ref]: https://www.opengl.org/sdk/docs/man4/index.php

## Cross-Stage Persistence in SHFL

While sharing data between stages is straightforward in Alltheworld's homogeneous JavaScript mode, the SHFL mode has more work to do to build communication channels among the CPU and the rendering stages on the GPU.

### Uniform Variables

In the example above, we use cross-stage persistence to share data between the CPU and GPU. For example, the `model` matrix is initialized in the setup stage but used in the vertex shader. When a host communicates a value to a shader like this, it is traditionally called a [uniform variable][uniform], because the value is constant across invocations of the shader body. In the compiled code for the above example, you'll see several calls like `gl.uniformMatrix4fv(...)`. That's [the WebGL function for binding uniforms][uniformMatrix4fv] of the appropriate type.

### Vertex Attributes

Graphics APIs have a second mechanism for sending data to shaders that differs per vertex, called *vertex attributes*. In our above example, the `position` variable is an array of vectors indicating the location of each vertex. We don't want to pass the entire array to every invocation of the vertex shader---instead, each invocation should get a different vector, as if we had called `map` on the array.

To this end, SHFL handles cross-stage persistence specially when sharing arrays from the host to a shader. If an expression `e` has type `T Array`, then in a shader quote, the persist-escape expression `%[e]` has the element type `T`. The compile code uses WebGL's APIs to bind the array as an attribute instead of a uniform.

[uniform]: https://www.opengl.org/wiki/Uniform_(GLSL)
[uniformMatrix4fv]: https://msdn.microsoft.com/en-us/library/dn302458(v=vs.85).aspx

### Varying

The third communication mode that SHFL provides is between different stages of the graphics pipeline. If you need to perform some computation in the vertex stage and communicate it to the fragment stage, this is the mechanism you need. In OpenGL, variables like this use a `varying` qualifier, so they are sometimes just called *varyings*. In SHFL, stage-to-stage communication looks the same between GPU stages as it does when communicating from the CPU and GPU. Persists and cross-stage references work how you expect them to, and SHFL compiles them to GLSL varyings.

## Reusable Shaders

So far, our example has statically inlined the shading code with the host code. Realistically, we need to be able to separate the two. This separation is not only helpful for building a cleaner abstraction, but also so the shader can be decoupled from the object it "paints": you'll want to draw multiple objects with a single shader, or choose between multiple shaders for a single object.

In SHFL, you can encapsulate shaders just by wrapping them in functions. Since shader programs are first-class values, this works without any special consideration:

    def solid(pos: Float3 Array, model: Mat4, color: Vec3)
      vtx s<
        gl_Position = projection * view * model * vec4(pos, 1.0);
        frag s<
          gl_FragColor = vec4(color, 1.0);
        >
      >;

This function, `solid`, takes the vertex position array and model-space matrix for the object it will draw along with the color to use as a red/green/blue vector. The global `projection` and `view` matrices come from closed-over state. Passing the shader to the `vtx` intrinsic binds it and its associated uniforms and attributes.

Here's [a more complete example][example-objects] that uses a function-wrapped shader to draw two different objects.

[example-objects]: http://adriansampson.net/atw/#example=objects


# Loose Ends

If you keep playing with Alltheworld and SHFL, you'll quickly notice that this is a research prototype. Here are a few of the most glaring current omissions:

- Parse errors are frequently useless: they'll point you toward a seemingly irrelevant part of the code. In SHFL mode, the line number also reflects the (hidden) preamble code.
- Type errors are often vague and don't have source position information.
- Missing control flow constructs: `if`, `while`, and `for`.
- Shaders and their parameters are currently coupled: you can't bind a single shader and reuse it with multiple sets of uniforms and attributes.
- The set of exposed WebGL and GLSL features is small and ad hoc. We should expand our coverage of the built-ins.
- These intrinsics are not currently "world-specific." For example, you won't get a type error when trying to use [the GLSL function `normalize`][normalize] in host code or the [JavaScript function `Date.now`][Date.now] in shader code---things will just break silently.
- Functions defined in shader code are not supported. You should also be able to share functions defined at the host stage inside shaders; this is also not implemented.

[normalize]: https://www.opengl.org/sdk/docs/man/html/normalize.xhtml
[Date.now]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/now

The major missing features, which I'm working on now, are:

- We need constructs for compile-time metaprogramming of later stages.
