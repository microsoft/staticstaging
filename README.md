Static Staging Compiler
=======================

[![build status](https://circleci.com/gh/Microsoft/staticstaging.svg?style=shield&circle-token=c39f027c650d4a4e2c6f9b59868309c210228de3)](https://circleci.com/gh/Microsoft/staticstaging)

This is an experimental programming language for heterogeneous systems based on multi-stage programming. See [the documentation][docs] for an introduction to the language.

The compiler is written in [TypeScript][] and runs on [Node][].
You can build the compiler and run a few small programs by typing `make test` (if you have [npm][]).
Check out the [code documentation][hacking] for an introduction to the compiler's internals.

[npm]: https://www.npmjs.com/
[Node]: https://nodejs.org/
[TypeScript]: http://www.typescriptlang.org/
[docs]: http://microsoft.github.io/staticstaging/docs/
[hacking]: http://microsoft.github.io/staticstaging/docs/hacking.html

## Details

The license is [MIT][].
This project uses the [Microsoft Open Source Code of Conduct][coc]; check out the [FAQ about the CoC][cocfaq].

[MIT]: https://opensource.org/licenses/MIT
[coc]: https://opensource.microsoft.com/codeofconduct/
[cocfaq]: https://opensource.microsoft.com/codeofconduct/faq/
