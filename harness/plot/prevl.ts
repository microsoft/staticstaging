#!/usr/bin/env node
/// <reference path="../../typings/globals/node/index.d.ts" />

import * as fs from 'fs';

function read_string(filename: string): Promise<string> {
  return new Promise((resolve, reject) => {
    fs.readFile(filename, function (err: any, data: any) {
      if (err) {
        reject(err);
      } else {
        resolve(data.toString());
      }
    });
  });
}

function read_stdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let chunks: string[] = [];
    process.stdin.on("data", function (chunk: string) {
      chunks.push(chunk);
    }).on("end", function () {
      resolve(chunks.join(""))
    }).setEncoding("utf8");
  });
}

/**
 * Main function.
 */
function prevl() {
  let datafile = process.argv[2];
  read_stdin().then((json) => {
    let data = JSON.parse(json);

    // Adjust the data file.
    if (datafile) {
      data['data']['url'] = datafile;
    }

    process.stdout.write(JSON.stringify(data));
  });
}

prevl();
