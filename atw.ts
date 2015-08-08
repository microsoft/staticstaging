/// <reference path="typings/node/node.d.ts" />
var fs = require('fs');
var parser = require('./parser.js');

let fn = process.argv[2];
if (!fn) {
  console.log("no input provided");
  process.exit(1);
}
fs.readFile(fn, function (err, data) {
  console.log(parser.parse(data));
});
