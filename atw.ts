/// <reference path="typings/node/node.d.ts" />
/// <reference path="typings/minimist/minimist.d.ts" />

/// <reference path="src/driver.ts" />

let fs = require('fs');
let util = require('util');
let minimist = require('minimist');
let parser = require('./parser.js');

function read_string(filename: string, f: (s: string) => void) {
  fs.readFile(filename, function (err: any, data: any) {
    if (err) {
      console.log(err);
      process.exit(1);
    }
    f(data.toString());
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

  // Configure the driver.
  let config: DriverConfig = {
    parser: parser,
    webgl: webgl,

    log: (verbose ? console.log : (_ => void 0)),
    error (e: string) {
      console.error(e);
      process.exit(1);
    },

    parsed: (_ => void 0),
    typed: (_ => void 0),

    checked (tree: SyntaxNode, type_table: TypeTable) {
      if (compile) {
        driver_compile(config, tree, type_table);
      } else {
        driver_interpret(config, tree, type_table);
      }
    },
    compiled (code: string) {
      if (execute) {
        driver_execute(config, code);
      } else {
        console.log(code);
      }
    },
    executed: console.log,
  };

  // Read the source file and run the driver.
  read_string(fn, function (source) {
    driver_frontend(config, source, fn);
  });
}

main();
