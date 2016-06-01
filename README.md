Static Staging Compiler
=======================

[![build status](https://circleci.com/gh/microsoft/staticstaging.svg?style=shield&circle-token=656c5c2a93fd48c8b2e1b1c4780b5a8a3ba4cae6)](https://circleci.com/gh/microsoft/staticstaging)

This is an experimental programming language for heterogeneous systems based on multi-stage programming. See [the documentation][docs] for an introduction to the language.

The compiler is written in [TypeScript][] and runs on [Node][].
You can build the compiler and run a few small programs by typing `make test` (if you have [npm][]).
Check out the [code documentation][hacking] for an introduction to the compiler's internals.
The license is [MIT][].

[MIT]: https://opensource.org/licenses/MIT
[npm]: https://www.npmjs.com/
[Node]: https://nodejs.org/
[TypeScript]: http://www.typescriptlang.org/
[docs]: http://microsoft.github.io/staticstaging/docs/
[hacking]: http://microsoft.github.io/staticstaging/docs/hacking.html
