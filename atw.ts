/// <reference path="typings/node/node.d.ts" />
let fs = require('fs');
let parser = require('./parser.js');

let fn = process.argv[2];
if (!fn) {
  console.log("no input provided");
  process.exit(1);
}
fs.readFile(fn, function (err, data) {
  if (err) {
    console.log(err);
    process.exit(1);
  }
  let s = data.toString();

  let tree;
  try {
    tree = parser.parse(s);
  } catch (e) {
    if (e instanceof parser.SyntaxError) {
      console.log('parse error, ' + fn + ':' + e.line + ',' + e.column
                  + ': ' + e.message);
      process.exit(1);
    } else {
      throw e;
    }
  }

  console.log(tree);
});
