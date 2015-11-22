/// <reference path="interp.ts" />
/// <reference path="pretty.ts" />
/// <reference path="type_elaborate.ts" />
/// <reference path="sugar.ts" />
/// <reference path="compile/compile.ts" />
/// <reference path="backends/js.ts" />
/// <reference path="backends/webgl.ts" />

module Driver {

// This is a helper library that orchestrates all the parts of the compiler in
// a configurable way. You invoke it by passing continuations through all the
// steps using a configuration object that handles certain events. The steps
// are:
//
// - `frontend`: Parse, typecheck, and desugar. This needs to be done
//   regardless of whether you want to compile or interpret.
// - `interpret`: More or less what it sounds like.
// - `compile`: Compile the checked code to executable code.
// - `execute`: Run the compiled code, hopefully getting the same
//   result as the interpreter would.

export interface Config {
  parser: any,  // The parser object from PEG.js.
  webgl: boolean,

  parsed: (tree: SyntaxNode) => void,
  typed: (type: string) => void,
  error: (err: string) => void,
  log: (...msg: any[]) => void,
}

function _intrinsics(config: Config): Types.TypeMap {
  if (config.webgl) {
    return Backends.GL.INTRINSICS;
  } else {
    return Types.Check.BUILTIN_OPERATORS;
  }
}

function _runtime(config: Config): string {
  let runtime = Backends.JS.RUNTIME + "\n";
  if (config.webgl) {
    runtime += Backends.GL.WebGL.RUNTIME + "\n";
  }
  return runtime;
}

function _types(config: Config): Types.TypeMap {
  if (config.webgl) {
    return assign({}, Types.BUILTIN_TYPES, Backends.GL.GL_TYPES);
  } else {
    return Types.BUILTIN_TYPES;
  }
}

function _check(config: Config): Gen<Types.Check.TypeCheck> {
  let check = Types.Check.gen_check;
  if (config.webgl) {
    check = compose(Backends.GL.GLSL.type_mixin, check);
  }
  return check;
}

export function frontend(config: Config, source: string,
    filename: string,
    checked: (tree: SyntaxNode, type_table: Types.Elaborate.TypeTable) => void)
{
  // Parse.
  let tree: SyntaxNode;
  try {
    tree = config.parser.parse(source);
  } catch (e) {
    if (e instanceof config.parser.SyntaxError) {
      let loc = e.location.start;
      let err = 'parse error at ';
      if (filename) {
        err += filename + ':';
      }
      err += loc.line + ',' + loc.column + ': ' + e.message;
      config.error(err);
      return;
    } else {
      throw e;
    }
  }
  config.log(tree);

  // Check and elaborate types.
  let elaborated: SyntaxNode;
  let type_table: Types.Elaborate.TypeTable;
  try {
    [elaborated, type_table] =
      Types.Elaborate.elaborate(tree, _intrinsics(config), _types(config),
          _check(config));
    let [type, _] = type_table[elaborated.id];
    config.typed(Types.pretty_type(type));
  } catch (e) {
    config.error(e);
    return;
  }
  config.log('type table', type_table);

  checked(elaborated, type_table);
}

export function compile(config: Config, tree: SyntaxNode,
    type_table: Types.Elaborate.TypeTable, compiled: (code: string) => void)
{
  let ir: CompilerIR;
  ir = semantically_analyze(tree, type_table, _intrinsics(config));

  // Log some intermediates.
  config.log('def/use', ir.defuse);
  config.log('progs', ir.progs);
  config.log('procs', ir.procs);
  config.log('main', ir.main);

  // Compile.
  let jscode: string;
  try {
    if (config.webgl) {
      jscode = Backends.GL.WebGL.emit(ir);
    } else {
      jscode = Backends.JS.emit(ir);
    }
  } catch (e) {
    if (typeof(e) === "string") {
      config.error(e);
      return;
    } else {
      throw e;
    }
  }

  compiled(jscode);
}

export function interpret(config: Config, tree: SyntaxNode,
    type_table: Types.Elaborate.TypeTable, executed: (result: string) => void)
{
  // Remove syntactic sugar.
  let sugarfree = desugar(tree, type_table, _check(config));
  config.log('sugar-free', sugarfree);

  let val = Interp.interpret(sugarfree);
  executed(Interp.pretty_value(val));
}

// Get the complete, `eval`-able JavaScript program, including the runtime
// code.
export function full_code(config: Config, jscode: string): string {
  return _runtime(config) + jscode;
}

export function execute(config: Config, jscode: string,
    executed: (result: string) => void)
{
  let res = scope_eval(full_code(config, jscode));
  if (config.webgl) {
    throw "error: driver can't execute WebGL programs";
  }

  // Pass a formatted value.
  executed(Backends.JS.pretty_value(res));
}

}
