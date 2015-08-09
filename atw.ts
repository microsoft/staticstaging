/// <reference path="typings/node/node.d.ts" />
let fs = require('fs');
let parser = require('./parser.js');

interface SyntaxNode {
  tag: string;
}

interface ExpressionNode extends SyntaxNode {
}

interface LiteralNode extends ExpressionNode {
  value: number;
}

interface SeqNode extends ExpressionNode {
  lhs: ExpressionNode;
  rhs: ExpressionNode;
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

interface Env {
  [key: string]: number;
}

function interpret_literal(tree: LiteralNode, env: Env) {
  return tree.value;
}

function interpret_seq(tree: SeqNode, env: Env) {
  interpret(tree.lhs, env);
  return interpret(tree.rhs, env);
}

// Dispatch based on tag. A somewhat messy alternative to constructing the AST
// in a type-safe way, but it'll do.
function interpret(tree: SyntaxNode, env: Env = {}): any {
  switch (tree.tag) {
    case "literal":
      return interpret_literal(<LiteralNode> tree, env);
    case "seq":
      return interpret_seq(<SeqNode> tree, env);

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
    console.log(tree);
    console.log(interpret(tree));
  });
}

main();
