/// <reference path="typings/node/node.d.ts" />

let fs = require('fs');

const FRONT_MATTER_MARKER = /---\n/;
const KEY_VALUE_PAIR = /(\w+): (.*)$/;

function read_string(filename: string, f: (s: string) => void) {
  fs.readFile(filename, function (err: any, data: any) {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    f(data.toString());
  });
}

function split_front_matter(s: string): [string, string] {
  let index = s.search(FRONT_MATTER_MARKER);
  if (index === -1) {
    return ['', s.trim()];
  } else {
    return [s.slice(0, index).trim(), s.slice(index).trim()];
  }
}

type StringMap = { [ key: string]: string };
function parse_front_matter(s: string): StringMap {
  let out: StringMap = {};
  for (let line of s.split(/\n/)) {
    let res = line.match(KEY_VALUE_PAIR);
    if (res) {
      out[res[1]] = res[2];
    }
  }
  return out;
}

function main() {
  let args = process.argv.slice(2);

  let out: StringMap[] = [];
  for (let fn of args) {
    read_string(fn, function (s) {
      let [front, back] = split_front_matter(s);
      let values = parse_front_matter(front);
      values['body'] = back;
      out.push(values);
    });
  }

  // WRONG, due to async.
  let json = JSON.stringify(out);

  process.stdout.write(json);
}

main();
