/// <reference path="../src/interp.ts" />
/// <reference path="../src/pretty.ts" />
/// <reference path="../src/type.ts" />

declare var parser : any;
const RUN_DELAY_MS = 200;

// Run code and return:
// - an error, if any
// - the parse tree
// - the type
// - the result of interpretation
function atw_run(code: string) : [string, string, string, string] {
  // Parse.
  let tree: SyntaxNode;
  try {
    tree = parser.parse(code);
  } catch (e) {
    let err = 'parse error at '
              + e.line + ',' + e.column
              + ': ' + e.message;
    return [err, null, null, null];
  }

  // Log the parse tree.
  let parse_tree : string;
  try {
    parse_tree = tree.toString();
  } catch (e) {
    return [e, null, null, null];
  }

  // Log the type.
  let type_str : string;
  try {
    type_str = pretty_type(typecheck(tree));
  } catch (e) {
    return [e, null, null, null];
  }

  // Show the result value.
  return [
    null,
    parse_tree,
    type_str,
    pretty_value(interpret(tree)),
  ];
}

document.addEventListener("DOMContentLoaded", function () {
  let codebox = <HTMLTextAreaElement> document.querySelector('textarea');
  let errbox = <HTMLParagraphElement> document.querySelector('#error');
  let treebox = <HTMLPreElement> document.querySelector('#tree');
  let typebox = <HTMLParagraphElement> document.querySelector('#type');
  let outbox = <HTMLPreElement> document.querySelector('#result');

  function run_code() {
    let code = codebox.value;
    let [err, tree, typ, res] = atw_run(code);
    errbox.textContent = err;
    treebox.textContent = tree;
    typebox.textContent = typ;
    outbox.textContent = res;
  }

  codebox.addEventListener('input', function () {
    setTimeout(run_code, RUN_DELAY_MS);
  });
});
