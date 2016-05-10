title: Alltheworld Compiler Implementation

[TITLE]

This is the documentation for the Alltheworld compiler implementation.
You may also be interested in the [language documentation](index.html).


# Build and Run

To get the compiler running, install [Node][] and [npm][]. Then, on Unix, just type `make` to install the dependencies and build the project. Or you can run these commands manually:

    $ npm install
    $ npm run build

Then, you can install the `atw` command-line program by typing:

    $ npm link

To make sure it's working, you can try running an example:

    $ atw test/basic/add.atw

[npm]: https://www.npmjs.com/
[Node]: https://nodejs.org/

## Command Line

Type `atw -h` for usage. The most important options are:

* `-c`: Use the compiler to JavaScript. Otherwise, the interpreter is used instead. By default, this dumps the compiled JavaScript code to the standard output.
- `-x`: When in compiler mode, run the resulting JavaScript code with `eval` and print the output. Together, `-cx` should give you the same output as running the interpreter (with no options at all).
- `-w`: Use the WebGL language extension. (Only valid in compiler mode.)

There's also `-v` for debugging output and `-g` for program generation, as described in the language overview.

## Web Dingus

There's also an interactive browser frontend. On Unix, just type `make` in the `dingus` directory, or otherwise use the same `npm run build` dance. Then, open `index.html` in your browser.

The dingus seems to work in current versions of Safari, Firefox, Chrome, and Microsoft Edge.


# Compiler Architecture

~ Figure { caption: "The primary data structures in the Atw compiler. Not pictured are a few minor data structures generated during semantic analysis and used by the backends: the proc/prog mapping and the extern list, for example." }
![alltheworld compiler architecture](alltheworld.svg)
~

The crude diagram at the right shows all the data structures in the Atw compiler workflow.
The main phases in the compiler are:

* The raw AST, i.e., the pristine output from the parser.
* Type elaboration and desugaring, which produces a high-level IR that can be interpreted.
* Additional semantic analysis: most importantly, a def/use analysis and "scope lifting," which generalizes lambda lifting to both functions and quotes.

This section gives more overview on how the pieces go together. The latter sections give more detail on the more novel components work.

## Parser

The parser uses a popular [parsing expression grammar][peg] parser-generator library called [PEG.js][].
To stay as modular as possible, the parser produces an AST as a JSON data structure.
Every object in the JSON is tagged with a string that indicates the type of the AST node (e.g., "let", "seq", "fun").
All the other IRs in the compiler are based on variants of this JSON AST, and the major components all dispatch on the tags to recursively process the tree.
The [web dingus][dingus] can draw the JSON document tree visually.

[peg]: https://en.wikipedia.org/wiki/Parsing_expression_grammar
[peg.js]: http://pegjs.org/
[dingus]: http://adriansampson.net/atw/

## Type Checking and Elaboration

To turn the raw parse tree to a more useful IR, we attach sequential numeric IDs to every node in the AST.
This lets us build tables that decorate the AST with extra information without actually mutating it (which we'll need to do repeatedly in the rest of the compiler).
We could have used the identity of the node objects (i.e., their pointers) instead of handcrafted IDs, but JavaScript does not expose a useful notion of object identity.

The type checker runs next. It works as a type *elaborator:* it produces a table mapping node IDs to type information.
Specifically, the table tracks each node's type and its *type environment* (a mapping from names to types used in type checking).

The high-level IR that forms the output here consists of the ID-stamped AST and the type table.
This elaborated IR is essential for the next step, desugaring.

## Syntactic Sugar

It's possible to view cross-stage variable references in our language as syntactic sugar. Specifically, if you have a program like this:

    var x = 5;
    < x >

This is semantically equivalent to:

    var x = 5;
    < %[x] >

That is, the concept called *cross-stage persistence* in the literature, where variables defined outside of a quote are also available inside, can be seen as inessential: you can just as easily express the same thing by sprinkling in explicit `%[...]` escapes.

Even though the semantics are the same, however, the performance can differ. For example, this program:

    var x = 5;
    < %[x] + %[x] >

creates a quote that needs to communicate the value of `x` *twice* before adding it. From the language's perspective, these are two different expressions that happen to produce the same value.

So desugaring `x` to `%[x]` loses information that the compiler needs. For this reason, Atw implements desugaring but *only for the interpreter*. Desugaring significantly simplifies the implementation of the interpreter, but we do not use it to implement cross-stage references in the compiler.

Desugaring works using the results from type elaboration.
We traverse to every variable reference and
look up the variable in the associated type environment.
The table gives us the stage at which the variable was defined.
If it is the current stage, the reference is left unchanged; otherwise, it is wrapped in the appropriate number of escape expressions.
We re-run the type checker on the generated AST fragment, starting from the saved environment for the original node, and amend the type table accordingly to ensure that the entire AST remains elaborated.

## Mid-Level IR and Backends

The rest of the compiler machinery is a collection of semantic analyses.
They produce a "mid-level IR" that the backend uses to generate code.
This IR is actually a little struct consisting of these fields:

- `type_table`: The result of type elaboration. Maps the ID of every expression in the program to its type (and complete type environment).
- `defuse`: A definition/use table that maps the ID of each variable reference nodes to ID of the node where it was defined.
- `procs`: A set of *procedures*, which are the result of lambda lifting. There is one procedure per `fun` node in the AST, so the procedures are indexed by the ID of the corresponding `fun`.
- `main`: One more procedure for the top-level code in the program.
- `progs`: A set of *programs*, which are the result of "quote lifting." Analogously to `procs`, these are indexed by the corresponding quote node.
- `containers`: An ID-to-ID mapping containing, for every node in the AST, the node of the scope that contains it. The containing scope is either a function or a quote.

The procedures (`procs`) and programs (`progs`) in the IR are themselves structs, and they contain subtrees of the otherwise-unmodified desugared AST.
Both structs inherit from a common `Scope` base type, which includes nearly all the data---free variables, bound variables, parent scope, child scopes, etc.
Both even need to keep track of escapes, because persists are a generalization of free variables.
The only differences are that procedures have arguments and programs have annotations (discussed below).

# How to Compile Stages

There's not much of anything in the literature about implementing compilers for multi-stage languages.
Papers in the [MetaML][] vein tend to use operational semantics that closely correspond to interpreters.
[Terra][] and [Scala LMS][] are real implementations, but they are geared toward simple code generation scenarios---they do not express multiple stages that collaborate in the same process.
As a result, they build up ASTs at run time that are only then sent through the compiler.
That would be performance disaster for our scenario.
[BER MetaOCaml][metaocaml] is similar; it translates staging into reflection-based code that builds up OCaml ASTs.

We need another way. Specifically, we want to compile quotations (code values) *eagerly* as far as we can at compile time---to the same level of abstraction as unstaged code---while retaining the ability to splice and execute it.
This is a trickier path.
Quoth the designer of BER MetaOCaml:

> A code value could represent bits of low-level code; however, they are very difficult to compose.

That's why that implementation (and most others) opt to just represent code as high-level ASTs.
[Jeannie][] is closer than any of the work that calls itself "multi-stage programming" because of its need to generate (ahead of time) two different programming languages.
Most of the novelty in the Atw compiler lies in its ability to "really compile" quotations.

[metaml]: http://dl.acm.org/citation.cfm?id=259019
[metaocaml]: http://okmij.org/ftp/ML/MetaOCaml.html#implementing-staging
[terra]: http://terralang.org
[jeannie]: http://cs.nyu.edu/rgrimm/papers/oopsla07.pdf
[scala lms]: https://scala-lms.github.io/

To make the distinction here clear, I offer the following litmus test.
In many staging implementations, it is natural and easy to pretty-print quotations as code.
If a "staged" language supports pretty-printing, it is representing code as run-time AST values and it is *not* what we want.
The interpreter for Atw is an example: code values are really just thin wrappers over the same AST data structure used by the type checker.
The Atw compiler, in contrast, makes it *impossible by design* to pretty-print code values: all remnants of the AST are gone after everything is compiled.
Code values are executable code.
Credit to Ömer Sinan Ağacan's blog post, ["Staging is not just code generation,"][osa1-csp] for first making this distinction.

[osa1-csp]: http://osa1.net/posts/2015-05-17-staging-is-not-just-codegen.html

## Splicing vs. Persisting

A key distinction the Atw language and compiler is the distinction between the two different ways that different stages can communicate with each other.

* The first is *splicing*, which takes a *code value* from one stage and stitches it into the current code value. In Atw, you use plain brackets to express splicing. For example, `var a = <5>; < 6 + [a] >` produces the complete code value `<6 + 5>`.
* The second is *persisting*, a verb I made up to describe what the [MetaML][] paper calls "cross-stage persistence." Persisting lets two different stages share the same data. There is no program-stitching involved. In Atw, you use `%[e]` to denote persistence. For example, `var a = 5; < 6 + %[a] >` produces a code value like `<6 + %p7>` where `%p7` is an opaque kind of expression that means "look up a value from a different stage." We use a unique identifier, `p7` in this example, for every persist to look up the right value in a quote's associated persist environment (see the section on "quote lifting" below).

The importance of this distinction can't be overemphasized. It seems cosmetic from a semantic perspective---in fact, [BER MetaOCaml][metaocaml] intentionally confuses the two for convenience---but the performance implications are critical. Imagine a program that executes a quote expression a million times. If the quote uses a *splice*, the program will generate a million distinct subprograms at run time, each one with a different value spliced in as a literal. If it uses a *persist*, the compiler can generate only one quoted subprogram at compile time and reuse it a million times.

Even if you don't care about performance, you should still care about the distinction for the sake of value lifetimes. A nice artifact of splicing code is that it produces complete, self-contained programs that you can write to disk and use independently. This is sometimes called *residualization*, and it is the core idea that codegen-focused systems like [Scala LMS][] rely on. But it doesn't make sense to serialize some kinds of data: file descriptors and pointers, for example. These need persistence. For example, since BER MetaOCaml relies on splicing for all cross-stage sharing, it cannot move functions or ML references between across stages.

## Lambda Lifting and Quote Lifting

[Lambda lifting][] is the standard technique for compiling languages with closures.
Atw generalizes lambda lifting to apply to both functions and quotes simultaneously.
The compiler calls the combined transformation *scope lifting*.

[lambda lifting]: https://en.wikipedia.org/wiki/Lambda_lifting

The idea behind lambda lifting is to take every function and turn it into a *procedure* that doesn't close over any state---all of its parameters must be provided explicitly rather than picked up from the surrounding environment.
Procedures are placed in a global namespace, like C functions, and get extra parameters for every value they reference in their environment.
Function definition nodes are transformed to produce *closure values*, which consist of a procedure pointer and an environment mapping that holds values to pass to the procedure when it is called.

Quote lifting has a similar goal: extract all the quotes mixed into a program and turn them into global constants.
(Think of them as strings embedded in the `.text` section of an executable binary.)
Quote expressions also need to produce a closure-like value: they also consist of a pointer to the code and an environment---the environment contains the persisted outer-stage values.

General scope lifting recognizes that functions and quotes are nearly identical. Quotes don't have arguments and functions don't have escapes, but those are the only real differences. Atw's scope lifting pass finds free and bound variables in a uniform way for both kinds of scopes.

### Persists Generalize Free Variables

To compile persist escapes and free variables in quotes, Atw's quote-lifting analysis generalizes the concept of free variables in functions.
As an example, this program uses a persist inside of a function body:

    var y = 2;
    !<
      let f = fun x:Int -> x * %[y + 1];
      f 3
    >

After scope lifting, we should have a function contained in a string literal. In Atw's JavaScript backend, this looks something like:

    var prog1 =
    "function func1(x, persist1) {" +
    "  return x * persist1;" +
    "}" +
    "func1(3, persist1)";
    var y = 2;
    eval(prog1, persist1: y + 1);

Specifically, the persisted value (here, `persist1`) must become *part of the quoted function's environment*.
The same logic applies as for free variables: a reference to `y` in the function's body would this imply `y` is a free variable for the function, and thus require inclusion in the function's closure environment.

The conclusion is that you can view persist escapes as a reference to a free variable, where the free variable is defined just before the quote. A program with a persist escape:

    < ... %[ expr ] ... >

is equivalent to one with a free variable reference to a temporary:

    var temp = expr;
    < ... temp ... >

## Splicing Program Values

To implement splicing, we need to be able to combine two program values at run time.
Specifically, we need to have a runtime available with a *splice* operation that takes as input an outer program, an inner program, and an indication of where to splice the latter into the former.
The operation needs to combine the persist values associated with both programs to produce a new mapping with their union.

In our JavaScript backend, this splicing works by string interpolation.
Every escape in a quote becomes a special token like `__SPLICE_21__`; we use `String.replace` to stitch in the spliced code at the right token.
Persists can be combined by taking the union of the two component name maps.

### Splicing and Functions

One crucial detail is that lambda lifting needs to be quote-aware.
That is, we need to lift functions into the quotation that contains it.
For example, this program uses an escape inside of a function definition:

    var x = <5>;
    var f = !< fun y:Int -> y + [x] >;
    f 2

This only works if the function is defined *inside* a quotation so it can be spliced into.

In a homogeneous environment, where all code is compiled to the same language, the opposite direction is not a problem. This program defines a function outside a quote and then uses a persist to call it inside a quote:

    var f = fun x:Int -> x * 2;
    !< %[f] 3 >

The closure value named `f` can stick around to be used when the quote is executed.
In a heterogeneous target (e.g., JavaScript + GLSL), though, this won't work: you can't take a function defined in language A and call it in language B without an FFI.
And in our scenario, it's even worse: the programs run on different hardware with different ISAs.
For that scenario, we probably want to explore compiling those outer functions *twice*, once for each target, so they can be used in both places.

## N-Level Escapes

Our language extends traditional multi-stage programming with $n$-level escapes. An escape written `[e]n` or `%[e]n` evaluates the expression `e` in the context that is $n$ levels up from the current quote. The implementation is mostly straightforward for multi-level persist escapes---they work the same way as cross-stage free variable references that span multiple stages. Multi-stage *splice* escapes, however, require more complexity.

Consider this small example:

    var c = <5>;
    !<!< [c]2 + 4 >>

There are three stages here: the outer stage and two nested quotes. The splicing needs to happen at the first, outermost stage---the generated code should not do any splicing in the latter stages. That is, we need to emit JavaScript code that looks like this:

    var prog1 = "
      var prog2 = \"
        __SPLICE__ + 4
      \";
      eval(prog2);
    ";
    eval(prog1.replace("__SPLICE__", "5"));

In particular, the string literal for the inner quote needs to appear *nested inside* the string for the outer quote. It won't work to hoist all the programs to the top-level namespace (as an earlier version of the Atw compiler would have):

    var prog1 = "eval(prog2)";
    var prog2 = "__SPLICE__ + 4";

because this would make it impossible to splice into `prog2`'s text when preparing prog1 for evaluation.

Incidentally, the correct nesting for $n$-level escapes also makes it possible to *residualize* programs. Since a quote contains everything it needs to execute, it is possible to write the program to a file and execute it later.

The correct nesting is also simpler to explain: each quote in the output is a self-contained, complete program. Generating code for a quotation amounts to a recursive invocation of the entire compiler. When Atw eventually grows a native-code backend, this will manifest as emitting a complete `.text` section for the subprogram's binary. We could consider an optional quotation mode that leads to more efficient in-process execution but prevents residualization by returning to the "hoisted" behavior, where all subprograms are linked into the main program's `.text` section.


# JavaScript, GLSL, and WebGL

The backends of the compiler start with the mid-level IR and generate code.
Namely, I have a complete implementation of a homogeneous JavaScript backend.
In this backend, quoted code is placed into global strings and executed with `eval`.
Persists are implemented as plain variable references which are bound using JavaScript's `with` statement.

## JavaScript Examples

Here are a few examples of the compiler concepts above, complete with the output JavaScript code.

### Quotes and Persisting

In the current implementation, the persist environment in a code value is a JavaScript object that maps unique string keys---which correspond to variable names in the quoted code---to values. The keys are generated based on the ID of each persist node in the original AST. For example, [this example program][splice]:

    var x = 5;
    !< 37 + %[x] >

compiles to JavaScript that looks roughly like this (stripping away the details):

    var q4 = "... 37 + p7 ...";
    var v1 = 5;
    var code = { prog: q4, persist: { p7: v1 } };
    with (code.persist)
      return eval(code.prog);

Note that the quotation gets compiled to a global string, `q4`.
The `code` object has two components: the program, a reference to `q4`, and a dictionary of persist values.
The `with (code.persist) eval(code.prog)` pattern executes the quoted code using the variable mapping set up in the `code` declaration, which makes `p7` resolve to 5.

[splice]: http://adriansampson.net/atw/#code=var%20x%20%3D%205%3B%0A!%3C%2037%20%2B%20%25%5Bx%5D%20%3E

### Expression Chains

If you experiment with the compiler, you'll notice that the output JavaScript doesn't use very many semicolons---it uses commas instead.
That's because was easier to chain *expressions* in the backend than to use a series of *statements*.
So [this tiny program][exprs]:

    var x = 5;
    var y = 9;
    x + y

compiles to:

    (function () {
      var v4, v1;
      return v1 = (5),
      v4 = (9),
      (v1) + (v4);
    })()

where the three expressions are chained with commas after the `return` keyword.
The `var` line pre-declares all the variables that we use in the code to make them into local JavaScript variables.

[exprs]: http://adriansampson.net/atw/#code=var%20x%20%3D%205%3B%0Avar%20y%20%3D%209%3B%0Ax%20%2B%20y

### The Cost of Desugaring

Our syntactic-sugar approach to cross-stage persistence comes at a cost when variables are used multiple times. For example, [this program][sugarcost]:

    var x = 5;
    !< x + x >

desugars to one with two persist escape expressions. This means that the compiler must communicate *two copies* of `x` from the first stage to the second. Note the duplication of `v` in the compiled code:

    var code = { prog: q4, persist: { p10: (v1), p8: (v1) } };

An alternative system that used bespoke mechanisms for cross-stage lookup instead of our desugaring approach could feasibly avoid this inefficiency.

[sugarcost]: http://adriansampson.net/atw/#code=var%20x%20%3D%205%3B%0A!%3C%20x%20%2B%20x%20%3E

### `extern` and Intrinsics

To make the language slightly more practical, I've I added an `extern` expression. It lets you declare values without defining them. This way, in the JavaScript backend, you can use plain JavaScript functions from your Atw program. [For example:][extern]

    extern Math.pow: Int Int -> Int;
    Math.pow 7 2

That program compiles to code that invokes JavaScript's own `Math.pow` by wrapping it in an Atw closure value:

    var closure = ({ proc: Math.pow, env: [] });
    var args = [(7), (2)].concat(closure.env);
    return closure.proc.apply(void 0, args);

[extern]: http://adriansampson.net/atw/#code=extern%20Math.pow%3A%20Int%20Int%20-%3E%20Int%3B%0AMath.pow%207%202

Unlike ordinary variables, `extern`s are "ambient": they're available at all (subsequent) stages without the need for persisting or splicing.

The compiler infrastructure also a has a notion of intrinsics, which are just externs that are implicitly defined. For example, `vtx` and `frag` are both intrinsics that get special handling in the WebGL/GLSL compiler. The output variables of shaders, `gl_Position` and `gl_Color`, are also intrinsics but don't get any special handling. To make this work, I had to add special rules for *mutating* externs. That way, an expression like this:

    gl_Color = x

generates code that actually assigns to the variable `gl_Color` defined in the target. (An ordinary mutation would update a new variable generated by the compiler.)

## WebGL Backend

Here are some less-organized notes on the hacky extensions I added to get the graphics-engine backend working.

### Choosing the Target Language

The compiler needs some way to decide what is host code and what is shader code so it can be compiled to the correct language. I see two options here:

1. Count the number of nested angle brackets \<\> and switch backends at some threshold.
2. Use an annotation to mark shader code.

I have gone with option 2, which makes it possible to put shader code by itself in a function and invoke it elsewhere. You write `s< ... >` to generate GLSL code.
The type system is also aware of annotations: for example, you will get an error if you try to use a quote that's compiled as JavaScript with the `vtx` intrinsic.

### Render Stage and Unmetaprogrammed Quotes

The language also needed a way to separate one-time setup code from the host-side code that gets executed on every frame. This is another perfect match for staging---clearly, the same issues of persistence and deferral arise. So we use a "render" stage that emits JavaScript code that draws stuff. This stage contains all the shaders.

But it would be silly to make this stage a string that gets `eval`ed, because we definitely don't need run-time metaprogramming for it. (That is, the setup code doesn't need to splice together code dynamically to determine what to run in the render loop.) So I've added *another* quote emission annotation, `f< ... >`, that emits the quote as an ordinary function. Splices are forbidden in these quotes. This is very close to the essence of "staging without metaprogramming" that this project is based on.

### Declaring In/Out Variables

GLSL uses explicit `in` and `out` type qualifiers (or, in WebGL version 1, the more arcane `attribute`/`uniform`/`varying` set of qualifiers). These qualifiers indicate communication between stages. To understand how to generate these declarations, the Atw compiler catalogs the nesting of quotations. During quote lifting, it records the IDs of all the "subprograms" contained contained within each lifted program.

Then, the WebGL backend requires that each vertex-shader program contain exactly one nested program: the fragment shader.
When emitting the code for the vertex shader, it enumerates the persists in the nested fragment shader and emits an `out` declaration for each.

All shader programs---vertex and fragment---get a corresponding `in` declaration for each of their escapes.

This strategy requires, currently, that you transition to fragment shading using a *literal* quote. That is, your code has to look like this:

    var shader = s<
      # vertex code here
      frag s<
        # fragment code here
      >
    >

But you *cannot* assign the fragment shader to a variable:

    var shader = s<
      # ...
      var fragment_shader = frag s<
        # ...
      >
      # ...
      frag fragment_shader
    >

and you can't include two different fragment shader programs and then choose between them. This way, we know *statically* which variables need to be passed to support all the persists in the inner program.

A similar constraint pops up when binding the vertex shader on the CPU. You need some way to decide which variables to bind as uniforms and attributes: this can either be static (by applying the same literal-quote constraint) or dynamic (but this incurs overhead).

### GLSL Types

To make the backend extensible, I have implemented the parser and type checker so that primitive types are just strings. The two built-in primitive types, `Int` and `Float`, are used in the type checker to give types to literals, but they have no special designation otherwise.

The WebGL backend adds primitive types for vectors and matrices. (They are called by the sensible HLSL-like names `Float3`, `Int4x4`, etc., but have OpenGL-like aliases like `Vec3` and `Mat4`.) It uses these types in the definition of its intrinsics.

### Attributes

The components I've described so far work for *uniforms* but not quite for *attributes*. To recap, uniforms are values passed from CPU to GPU that are constant across all iterations on the GPU (e.g., a timer value); vertex attributes are big arrays for which the GPU gets one element per iteration (e.g., the vertex position vector).

To define these values, I added an extremely limited form of polymorphic type constructors. You can now declare values of type `T Array` where `T` is some other type. Eventually, it would be nice to add full Hindley--Millner type inference, but at the moment, only intrinsics can construct and destruct these types.

The trick is that we type and compile cross-stage persistence differently in the for `T Array`s. That is, a program like this:

    extern buf: Float3 Array;
    s<
      let val = buf
    >

gives `val` the type `Float3`, not `Float3 Array` as it would normally. This array-to-element "degrading" only occurs when crossing the boundary into a shader stage (one marked with the "s" annotation). We also generate the code differently to communicate an attribute instead of a uniform.

I also considered an alternative design where you would need to write `cur a` to project an array to a single element inside a quote. This had two downsides:

* The `cur` function would need the polymorphic type `'a Array -> 'a`, so we'd need something closer to full Hindley--Millner. A custom type rule was simpler for this specific case.
* Since you can't communicate an entire array from the CPU to GPU anyway, you would *always* need to use `cur`. It would, from the programmer's perspective, be completely redundant, because whether you want `a` or `cur a` is entirely dictated by the context anyway.
