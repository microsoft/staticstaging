/// <reference path="typings/node/node.d.ts" />
/// <reference path="src/interp.ts" />
/// <reference path="src/pretty.ts" />
/// <reference path="src/type.ts" />

let fs = require('fs');
let util = require('util');
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
  let fn = process.argv[2];
  if (!fn) {
    console.log("no input provided");
    process.exit(1);
  }

  parse(fn, function (tree) {
    try {
      console.log(util.inspect(tree, false, null));
    } catch (e) {
      console.log(e);
      return;
    }
    try {
      console.log(pretty_type(typecheck(tree)));
    } catch (e) {
      console.log(e);
      return;
    }
    console.log(pretty_value(interpret(tree)));
  });
}

main();
