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
    parse_tree = JSON.stringify(tree, null, '  ');
  } catch (e) {
    return [e, null, null, null];
  }

  // Log the type.
  let type_str : string;
  try {
    type_str = pretty_type(typecheck(tree));
  } catch (e) {
    return [e, parse_tree, null, null];
  }

  // Show the result value.
  return [
    null,
    parse_tree,
    type_str,
    pretty_value(interpret(tree)),
  ];
}

function show(text: string, el: HTMLElement) {
  if (text) {
    el.textContent = text;
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}

document.addEventListener("DOMContentLoaded", function () {
  let codebox = <HTMLTextAreaElement> document.querySelector('textarea');
  let errbox = <HTMLParagraphElement> document.querySelector('#error');
  let treebox = <HTMLPreElement> document.querySelector('#tree');
  let typebox = <HTMLParagraphElement> document.querySelector('#type');
  let outbox = <HTMLPreElement> document.querySelector('#result');

  function run_code() {
    let code = codebox.value;
    if (code !== "") {
      let [err, tree, typ, res] = atw_run(code);
      show(err, errbox);
      show(tree, treebox);
      show(typ, typebox);
      show(res, outbox);
    } else {
      show(null, errbox);
      show(null, treebox);
      show(null, typebox);
      show(null, outbox);
    }
  }

  codebox.addEventListener('input', function () {
    setTimeout(run_code, RUN_DELAY_MS);
  });

  run_code();
});
