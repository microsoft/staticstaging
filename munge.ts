/// <reference path="typings/node/node.d.ts" />

let fs = require('fs');

function main() {
  let args = process.argv.slice(2);
  for (let fn of args) {
    console.log(fn);
  }
}

main();
