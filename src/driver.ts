/// <reference path="interp.ts" />
/// <reference path="pretty.ts" />
/// <reference path="type.ts" />
/// <reference path="sugar.ts" />
/// <reference path="compile.ts" />
/// <reference path="backend_js.ts" />
/// <reference path="backend_webgl.ts" />

interface DriverConfig {
  parser: any,  // The parser
  compile: boolean,
  webgl: boolean,

  parsed: (tree: SyntaxNode) => void,
  typed: (type: string) => void,
  executed: (result: string) => void,
  compiled: (code: string) => void,
  error: (err: string) => void,
  log: (...msg: any[]) => void,
}

function atw_driver(config: DriverConfig, source: string, filename: string = null) {
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
    config.log(pretty_type(type));
  } catch (e) {
    config.error(e);
    return;
  }
}
