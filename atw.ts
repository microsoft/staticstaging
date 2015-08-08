/// <reference path="typings/node/node.d.ts" />
let fs = require('fs');
let parser = require('./parser.js');

interface SyntaxNode {
  tag: string;
}

interface LiteralNode extends SyntaxNode {
  value: number;
}

function parse(filename: string, f: (tree: SyntaxNode) => void) {
  fs.readFile(filename, function (err, data) {
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
        console.log('parse error at '
                    + filename + ':' + e.line + ',' + e.column
                    + ': ' + e.message);
        process.exit(1);
      } else {
        throw e;
      }
    }

    f(tree);
  });
}

function interpret_literal(tree: LiteralNode) {
  return tree.value;
}

// Dispatch based on tag. A somewhat messy alternative to constructing the AST
// in a type-safe way, but it'll do.
function interpret(tree: SyntaxNode): any {
  switch (tree.tag) {
    case "literal":
      return interpret_literal(<LiteralNode> tree);

    default:
      console.log("error: unknown syntax node " + tree.tag);
      return;
  }
}

function main() {
  let fn = process.argv[2];
  if (!fn) {
    console.log("no input provided");
    process.exit(1);
  }

  parse(fn, function (tree) {
    // console.log(tree);
    console.log(interpret(tree));
  });
}

main();
