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

    var pi = <3.14>;
    def calc_area(r:Float)
      < [pi] * %[r * r] >;
    !calc_area(5.0) + !calc_area(2.0)

Like a splice escape, a persist escape shifts to the context outside of the quote and evaluates an expression. But instead of taking another code value and merging it in, a persist gets an ordinary value---here, plain old numbers---and makes them available inside the quote.

The difference may seem subtle, but it has an important effect on the generated code. The above code has two calls to `calc_area` with different values for `r`. If we had used a splice, this would have created and executed

TK compare to functions


## Cross-Stage References

## Staging Without Metaprogramming


# Graphics { data-mode=webgl }

test

    hello

## Render, Vertex, Fragment

## WebGL and GLSL Intrinsics

## Attributes and Uniforms

## Reusable Shaders
