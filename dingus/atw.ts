/// <reference path="../src/interp.ts" />
/// <reference path="../src/pretty.ts" />
/// <reference path="../src/type.ts" />

declare var parser : any;
const RUN_DELAY_MS = 200;

function atw_run(code: string) {
  // Parse.
  let tree: SyntaxNode;
  try {
    tree = parser.parse(code);
  } catch (e) {
    if (e instanceof parser.SyntaxError) {
      console.log('parse error at '
                  + e.line + ',' + e.column
                  + ': ' + e.message);
      return;
    } else {
      throw e;
    }
  }

  // Log the parse tree.
  try {
    console.log(tree);
  } catch (e) {
    console.log(e);
    return;
  }

  // Log the type.
  try {
    console.log(pretty_type(typecheck(tree)));
  } catch (e) {
    console.log(e);
    return;
  }

  // Show the result value.
  return pretty_value(interpret(tree));
}

document.addEventListener("DOMContentLoaded", function () {
  let codebox = <HTMLTextAreaElement> document.querySelector('textarea');
  let runbtn = <HTMLButtonElement> document.querySelector('button');
  let outbox = <HTMLPreElement> document.querySelector('pre');

  function run_code() {
    let code = codebox.value;
    let res = atw_run(code);
    outbox.textContent = res;
  }

  codebox.addEventListener('input', function () {
    setTimeout(run_code, RUN_DELAY_MS);
  });
});
