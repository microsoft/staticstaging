declare function require(name:string);
var parser = require('./parser.js');

console.log(parser.parse("   foo  "));
