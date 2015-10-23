/// <reference path="typings/node/node.d.ts" />
/// <reference path="typings/minimist/minimist.d.ts" />

/// <reference path="src/interp.ts" />
/// <reference path="src/pretty.ts" />
/// <reference path="src/type.ts" />
/// <reference path="src/sugar.ts" />
/// <reference path="src/compile.ts" />
/// <reference path="src/backend_js.ts" />
/// <reference path="src/backend_webgl.ts" />

let fs = require('fs');
let util = require('util');
let minimist = require('minimist');
let parser = require('./parser.js');

function parse(filename: string, f: (tree: SyntaxNode) => void) {
  fs.readFile(filename, function (err: any, data: any) {
    if (err) {
      console.log(err);
      process.exit(1);
    }
    let s = data.toString();

    let tree: SyntaxNode;
    try {
      tree = parser.parse(s);
    } catch (e) {
      if (e instanceof parser.SyntaxError) {
        let loc = e.location.start;
        console.log(
          'parse error at '
          + filename + ':' + loc.line + ',' + loc.column
          + ': ' + e.message
        );
        process.exit(1);
      } else {
        throw e;
      }
    }

    f(tree);
  });
}

function main() {
  // Parse the command-line options.
  let args = minimist(process.argv.slice(2), {
    boolean: ['v', 'c', 'x', 'w'],
  });

  // The flags: -v, -c, and -x.
  let verbose: boolean = args.v;
  let compile: boolean = args.c;
  let execute: boolean = args.x;
  let webgl: boolean = args.w;

  // Get the filename.
  let fn = args._[0];
  if (!fn) {
    console.error("usage: " + process.argv[1] + " [-vcx] PROGRAM");
    process.exit(1);
  }

  parse(fn, function (tree) {
    // Parse.
    try {
      if (verbose) {
        console.log(util.inspect(tree, false, null));
      }
    } catch (e) {
      console.log(e);
      return;
    }

    // Check and elaborate types.
    let elaborated : SyntaxNode;
    let type_table : TypeTable;
    try {
      if (webgl) {
        [elaborated, type_table] = webgl_elaborate(tree);
      } else {
        [elaborated, type_table] = elaborate(tree);
      }
      let [type, _] = type_table[elaborated.id];
      if (verbose) {
        console.log(pretty_type(type));
      }
    } catch (e) {
      console.log(e);
      return;
    }

    // Remove syntactic sugar.
    let sugarfree = desugar(elaborated, type_table);
    if (verbose) {
      console.log(util.inspect(sugarfree, false, null));
      let i = 0;
      for (let context of type_table) {
        console.log(i + ': ' + util.inspect(context, false, null));
        ++i;
      }
    }

    // Execute.
    if (compile) {
      let ir = semantically_analyze(sugarfree, type_table);

      // In verbose mode, show some intermediates.
      if (verbose) {
        console.log('def/use: ' + util.inspect(ir.defuse, false, null));
        console.log('progs: ' + util.inspect(ir.progs, false, null));
        console.log('procs: ' + util.inspect(ir.procs, false, null));
        console.log('main: ' + util.inspect(ir.main, false, null));
      }

      // Compile.
      let jscode: string;
      try {
        if (webgl) {
          jscode = webgl_compile(ir);
        } else {
          jscode = jscompile(ir);
        }
      } catch (e) {
        if (e === "unimplemented") {
          console.log(e);
          process.exit(1);
        } else {
          throw e;
        }
      }

      // Dump the resulting program or execute it.
      if (execute) {
        let runtime = JS_RUNTIME + "\n";
        if (webgl) {
          runtime += WEBGL_RUNTIME + "\n";
        }
        let res = scope_eval(runtime + jscode);
        console.log(pretty_js_value(res));
      } else {
        console.log(jscode);
      }

    } else {
      // Interpret.
      console.log(pretty_value(interpret(sugarfree)));
    }
  });
}

main();
