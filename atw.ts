/// <reference path="typings/node/node.d.ts" />
/// <reference path="typings/minimist/minimist.d.ts" />
/// <reference path="typings/es6-promise/es6-promise.d.ts" />

/// <reference path="src/driver.ts" />

let fs = require('fs');
let util = require('util');
let path = require('path');
let minimist = require('minimist');
let parser = require('./parser.js');

function read_string(filename: string, f: (s: string) => void) {
  fs.readFile(filename, function (err: any, data: any) {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    f(data.toString());
  });
}

// Check the output of a test. Return a success flag.
function check_output(filename: string, source: string, result: string): boolean {
  let name = path.basename(filename, '.atw');

  let [,expected] = source.split('# -> ');
  expected = expected.trim();
  result = result.trim();

  if (expected === result) {
    console.log(`${name} ✓`);
    return true;
  } else {
    console.log(`${name} ✘: ${result} (${expected})`);
    return false;
  }
}

function run(filename: string, source: string, config: Driver.Config,
    compile: boolean, execute: boolean, test: boolean)
{
  let success = true;

  Driver.frontend(config, source, filename, function (tree, types) {
    if (compile) {
      // Compiler.
      Driver.compile(config, tree, types, function (code) {
        if (execute) {
          Driver.execute(config, code, function (res) {
            if (test) {
              success = check_output(filename, source, res);
            } else {
              console.log(res);
            }
          });
        } else {
          console.log(code);
        }
      });

    } else {
      // Interpreter.
      Driver.interpret(config, tree, types, function (res) {
        if (test) {
          success = check_output(filename, source, res);
        } else {
          console.log(res);
        }
      });
    }
  });

  return success;
}

function main() {
  // Parse the command-line options.
  let args = minimist(process.argv.slice(2), {
    boolean: ['v', 'c', 'x', 'w', 't'],
  });

  // The flags: -v, -c, and -x.
  let verbose: boolean = args.v;
  let compile: boolean = args.c;
  let execute: boolean = args.x;
  let webgl: boolean = args.w;
  let test: boolean = args.t;

  // Get the filename.
  let filenames: string[] = args._;
  if (!filenames.length) {
    console.error("usage: " + process.argv[1] + " [-vcx] PROGRAM");
    process.exit(1);
  }

  // Log stuff, if in verbose mode.
  let log: (...msg: any[]) => void;
  if (verbose) {
    log = function (...msg: any[]) {
      let out: string[] = [];
      for (let m of msg) {
        if (typeof(m) === "string") {
          out.push(m);
        } else if (m instanceof Array) {
          for (let i = 0; i < m.length; ++i) {
            out.push("\n" + i + ": " +
                util.inspect(m[i], { depth: 1, colors: true }));
          }
        } else {
          out.push(util.inspect(m, { depth: null, colors: true }));
        }
      }
      // Work around a TypeScript limitation:
      // https://github.com/Microsoft/TypeScript/issues/4755
      console.log(out[0], ...out.slice(1));
    }
  } else {
    log = (_ => void 0);
  }

  // Configure the driver.
  let config: Driver.Config = {
    parser: parser,
    webgl: webgl,

    log: log,
    error (e: string) {
      console.error(e);
      process.exit(1);
    },

    parsed: (_ => void 0),
    typed: (_ => void 0),
  };

  // Read each source file and run the driver.
  let success = true;
  let promises = filenames.map(function (fn) {
    return new Promise(function (resolve, reject) {
      read_string(fn, function (source) {
        success = run(fn, source, config, compile, execute, test) && success;
        resolve();
      });
    });
  });
  Promise.all(promises).then(function() {
    if (!success) {
      process.exit(1);
    }
  });
}

main();
