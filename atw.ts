/// <reference path="typings/main.d.ts" />

import * as fs from 'fs';
import * as util from 'util';
import * as path from 'path';
import * as minimist from 'minimist';

import * as driver from "./src/driver";
import parser = require('./parser');

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

  let match: boolean;
  if (expected === "type error") {
    match = result.indexOf(expected) === 0;
  } else {
    match = expected === result;
  }

  if (match) {
    console.log(`${name} ✓`);
    return true;
  } else {
    console.log(`${name} ✘: ${result} (${expected})`);
    return false;
  }
}

function run(filename: string, source: string, webgl: boolean,
    compile: boolean, execute: boolean, test: boolean,
    log: (...msg: any[]) => void)
{
  let success = true;

  // Configure the driver.
  let config: driver.Config = {
    parser: parser,
    webgl: webgl,

    log: log,
    error (e: string) {
      if (test) {
        success = check_output(filename, source, e);
      } else {
        console.error(e);
        success = false;
      }
    },

    parsed: (_ => void 0),
    typed: (_ => void 0),
  };

  // Run the driver.
  driver.frontend(config, source, filename, function (tree, types) {
    if (compile) {
      // Compiler.
      driver.compile(config, tree, types, function (code) {
        if (execute) {
          driver.execute(config, code, function (res) {
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
      driver.interpret(config, tree, types, function (res) {
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
  let verbose: boolean = args['v'];
  let compile: boolean = args['c'];
  let execute: boolean = args['x'];
  let webgl: boolean = args['w'];
  let test: boolean = args['t'];

  // Get the filename.
  let filenames: string[] = args._;
  if (!filenames.length) {
    console.error("usage: " + process.argv[1] + " [-vcxwt] PROGRAM");
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

  // Read each source file and run the driver.
  let success = true;
  let promises = filenames.map(function (fn) {
    return new Promise(function (resolve, reject) {
      read_string(fn, function (source) {
        success = run(fn, source, webgl, compile, execute, test, log) && success;
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
