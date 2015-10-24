/// <reference path="interp.ts" />
/// <reference path="pretty.ts" />
/// <reference path="type.ts" />
/// <reference path="sugar.ts" />
/// <reference path="compile.ts" />
/// <reference path="backend_js.ts" />
/// <reference path="backend_webgl.ts" />

interface DriverConfig {
  parser: any,  // The parser object from PEG.js.
  webgl: boolean,

  checked: (tree: SyntaxNode, type_table: TypeTable) => void,
  compiled: (code: string) => void,
  executed: (result: string) => void,

  parsed: (tree: SyntaxNode) => void,
  typed: (type: string) => void,
  error: (err: string) => void,
  log: (...msg: any[]) => void,
}

function driver_frontend(config: DriverConfig, source: string,
    filename: string = null)
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
    if (config.webgl) {
      [elaborated, type_table] = webgl_elaborate(tree);
    } else {
      [elaborated, type_table] = elaborate(tree);
    }
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

  config.checked(sugarfree, type_table);
}

function driver_compile(config: DriverConfig, tree: SyntaxNode,
    type_table: TypeTable)
{
  let ir: CompilerIR;
  if (config.webgl) {
    ir = semantically_analyze(tree, type_table, WEBGL_INTRINSICS);
  } else {
    ir = semantically_analyze(tree, type_table);
  }

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
    if (e === "unimplemented") {
      config.error(e);
      return;
    } else {
      throw e;
    }
  }

  config.compiled(jscode);
}

function driver_interpret(config: DriverConfig, tree: SyntaxNode,
    type_table: TypeTable)
{
  let val = interpret(tree);
  config.executed(pretty_value(val));
}

function driver_execute(config: DriverConfig, jscode: string)
{
  let runtime = JS_RUNTIME + "\n";
  if (config.webgl) {
    runtime += WEBGL_RUNTIME + "\n";
  }
  let res = scope_eval(runtime + jscode);
  config.executed(pretty_js_value(res));
}
