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
  verbose: boolean,

  parsed: (tree: SyntaxNode) => void,
  typed: (type: string) => void,
  executed: (result: string) => void,
  compiled: (code: string) => void,
}
