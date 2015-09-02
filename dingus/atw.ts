/// <reference path="../src/interp.ts" />
/// <reference path="../src/pretty.ts" />
/// <reference path="../src/type.ts" />

declare var parser : any;

const RUN_DELAY_MS = 200;
const HASH_CODE = '#code=';

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
  let errbox = <HTMLElement> document.querySelector('#error');
  let treebox = <HTMLElement> document.querySelector('#tree');
  let typebox = <HTMLElement> document.querySelector('#type');
  let outbox = <HTMLElement> document.querySelector('#result');
  let helpbox = <HTMLElement> document.querySelector('#help');
  let clearbtn = <HTMLElement> document.querySelector('#clear');
  let examples = document.querySelectorAll('.example');

  function run_code() {
    let code = codebox.value;
    if (code !== "") {
      let [err, tree, typ, res] = atw_run(code);
      show(err, errbox);
      show(tree, treebox);
      show(typ, typebox);
      show(res, outbox);
      helpbox.style.display = 'none';
      location.hash = HASH_CODE + encodeURIComponent(code);
    } else {
      show(null, errbox);
      show(null, treebox);
      show(null, typebox);
      show(null, outbox);
      helpbox.style.display = 'block';
      location.hash = '';
    }
  }

  function handle_hash() {
    let hash = location.hash;
    if (hash.indexOf(HASH_CODE) == 0) {
      codebox.value = decodeURIComponent(hash.slice(HASH_CODE.length));
    } else {
      codebox.value = '';
    }
    run_code();
  }

  // Execute code by linking to it (pushing onto the history).
  function link_to_code(code: string) {
    let hash: string;
    if (code === "") {
      hash = '#';
    } else {
      hash = HASH_CODE + encodeURIComponent(code);
    }
    history.pushState(null, null, hash);
    handle_hash();
  }

  // Wait for code input and run it.
  let tid : number = null;
  codebox.addEventListener('input', function () {
    if (tid) {
      clearTimeout(tid);
    }
    tid = setTimeout(run_code, RUN_DELAY_MS);
  });

  // Example clicks load code.
  // Using a function here because JavaScript scoping is so sad.
  function add_example_handler(ex: HTMLElement) {
    ex.addEventListener('click', function () {
      link_to_code(ex.textContent);
    });
  }
  for (let i = 0; i < examples.length; ++i) {
    add_example_handler(<HTMLElement> examples[i]);
  }

  // Handle the "clear" button.
  clearbtn.addEventListener('click', function () {
    if (codebox.value != '') {
      link_to_code('');
    }
  });

  // Handle the empty hash and any new ones that are set.
  window.addEventListener('hashchange', function () {
    handle_hash();
  });
  handle_hash();
});
