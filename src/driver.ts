/// <reference path="interp.ts" />
/// <reference path="pretty.ts" />
/// <reference path="type_elaborate.ts" />
/// <reference path="sugar.ts" />
/// <reference path="compile.ts" />
/// <reference path="backend_js.ts" />
/// <reference path="backend_webgl.ts" />

// This is a helper library that orchestrates all the parts of the compiler in
// a configurable way. You invoke it by passing continuations through all the
// steps using a configuration object that handles certain events. The steps
// are:
//
// - `driver_frontend`: Parse, typecheck, and desugar. This needs to be done
//   regardless of whether you want to compile or interpret.
// - `driver_interpret`: More or less what it sounds like.
// - `driver_compile`: Compile the checked code to executable code.
// - `driver_execute`: Run the compiled code, hopefully getting the same
//   result as the interpreter would.

interface DriverConfig {
  parser: any,  // The parser object from PEG.js.
  webgl: boolean,

  parsed: (tree: SyntaxNode) => void,
  typed: (type: string) => void,
  error: (err: string) => void,
  log: (...msg: any[]) => void,
}

function _intrinsics(config: DriverConfig): TypeMap {
  if (config.webgl) {
    return GL_INTRINSICS;
  } else {
    return BUILTIN_OPERATORS;
  }
}

function _runtime(config: DriverConfig): string {
  let runtime = JS_RUNTIME + "\n";
  if (config.webgl) {
    runtime += WEBGL_RUNTIME + "\n";
  }
  return runtime;
}

function _types(config: DriverConfig): TypeMap {
  if (config.webgl) {
    return assign({}, BUILTIN_TYPES, GL_TYPES);
  } else {
    return BUILTIN_TYPES;
  }
}

function _check(config: DriverConfig): Gen<TypeCheck> {
  let check = gen_check;
  if (config.webgl) {
    check = compose(gl_type_mixin, check);
  }
  return check;
}

function driver_frontend(config: DriverConfig, source: string,
    filename: string,
    checked: (tree: SyntaxNode, type_table: TypeTable) => void)
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
  let type_table: TypeTable;
  try {
    [elaborated, type_table] =
      elaborate(tree, _intrinsics(config), _types(config), _check(config));
    let [type, _] = type_table[elaborated.id];
    config.typed(pretty_type(type));
  } catch (e) {
    config.error(e);
    return;
  }

  // Remove syntactic sugar.
  let sugarfree = desugar(elaborated, type_table);
  config.log('sugar-free', sugarfree);
  config.log('type table', type_table);

  checked(sugarfree, type_table);
}

function driver_compile(config: DriverConfig, tree: SyntaxNode,
    type_table: TypeTable, compiled: (code: string) => void)
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
      jscode = webgl_compile(ir);
    } else {
      jscode = jscompile(ir);
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

function driver_interpret(config: DriverConfig, tree: SyntaxNode,
    type_table: TypeTable, executed: (result: string) => void)
{
  let val = interpret(tree);
  executed(pretty_value(val));
}

function driver_execute(config: DriverConfig, jscode: string,
    executed: (result: any) => void)
{
  let res = scope_eval(_runtime(config) + jscode);
  if (config.webgl) {
    // Pass along the resulting JavaScript function.
    executed(res);
  } else {
    // Pass a formatted value.
    executed(pretty_js_value(res));
  }
}
