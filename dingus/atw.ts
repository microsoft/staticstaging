/// <reference path="../src/interp.ts" />
/// <reference path="../src/pretty.ts" />
/// <reference path="../src/type.ts" />
/// <reference path="../src/sugar.ts" />
/// <reference path="../src/backend_js.ts" />
/// <reference path="../src/backend_webgl.ts" />

declare var parser : any;
declare function tree_canvas (
  where: string,
  get_name: (_:any) => string,
  get_children: (_:any) => any[]
): (tree_data: any) => void;

const RUN_DELAY_MS = 200;

let GetChildren : ASTVisit<void, SyntaxNode[]> = {
  visit_literal(tree: LiteralNode, _: void): SyntaxNode[] {
    return [];
  },
  visit_seq(tree: SeqNode, _: void): SyntaxNode[] {
    return [tree.lhs, tree.rhs];
  },
  visit_let(tree: LetNode, _: void): SyntaxNode[] {
    return [tree.expr];
  },
  visit_assign(tree: LetNode, _: void): SyntaxNode[] {
    return [tree.expr];
  },
  visit_lookup(tree: LookupNode, _: void): SyntaxNode[] {
    return [];
  },
  visit_binary(tree: BinaryNode, _: void): SyntaxNode[] {
    return [tree.lhs, tree.rhs];
  },
  visit_quote(tree: QuoteNode, _: void): SyntaxNode[] {
    return [tree.expr];
  },
  visit_escape(tree: EscapeNode, _: void): SyntaxNode[] {
    return [tree.expr];
  },
  visit_run(tree: RunNode, _: void): SyntaxNode[] {
    return [tree.expr];
  },
  visit_fun(tree: FunNode, _: void): SyntaxNode[] {
    return [tree.body];
  },
  visit_call(tree: CallNode, _: void): SyntaxNode[] {
    return [tree.fun].concat(tree.args);
  },
  visit_extern(tree: ExternNode, _: void): SyntaxNode[] {
    return [];
  },
  visit_persist(tree: PersistNode, _: void): SyntaxNode[] {
    return [];
  },
};

function get_children(tree: SyntaxNode): SyntaxNode[] {
  return ast_visit(GetChildren, tree, null);
};

let GetName : ASTVisit<void, string> = {
  visit_literal(tree: LiteralNode, _: void): string {
    return tree.value.toString();
  },
  visit_seq(tree: SeqNode, _: void): string {
    return "seq";
  },
  visit_let(tree: LetNode, _: void): string {
    return "let " + tree.ident;
  },
  visit_assign(tree: LetNode, _: void): string {
    return tree.ident + " =";
  },
  visit_lookup(tree: LookupNode, _: void): string {
    return tree.ident;
  },
  visit_binary(tree: BinaryNode, _: void): string {
    return tree.op;
  },
  visit_quote(tree: QuoteNode, _: void): string {
    return "quote";
  },
  visit_escape(tree: EscapeNode, _: void): string {
    if (tree.kind === "persist") {
      return "persist";
    } else {
      return "escape";
    }
  },
  visit_run(tree: RunNode, _: void): string {
    return "run";
  },
  visit_fun(tree: FunNode, _: void): string {
    let params = "";
    for (let param of tree.params) {
      params += " " + param.name;
    }
    return "fun" + params;
  },
  visit_call(tree: CallNode, _: void): string {
    return "call";
  },
  visit_extern(tree: ExternNode, _: void): string {
    return "extern " + tree.name;
  },
  visit_persist(tree: PersistNode, _: void): string {
    return "%" + tree.index;
  },
}

function get_name(tree: SyntaxNode): string {
  return ast_visit(GetName, tree, null);
};

// Run code and return:
// - an error, if any
// - the parse tree
// - the type
// - the compiled code (if compiling)
// - the result of interpretation
// The mode can be "interp", "compile", or "webgl".
function atw_run(code: string, mode: string)
  : [string, SyntaxNode, string, string, string]
{
  // Parse.
  let tree: SyntaxNode;
  try {
    tree = parser.parse(code);
  } catch (e) {
    let loc = e.location.start;
    let err = 'parse error at '
              + loc.line + ',' + loc.column
              + ': ' + e.message;
    return [err, null, null, null, null];
  }

  // Elaborate and log the type.
  let elaborated : SyntaxNode;
  let type_table : TypeTable;
  try {
    if (mode === "webgl") {
      [elaborated, type_table] = webgl_elaborate(tree);
    } else {
      [elaborated, type_table] = elaborate(tree);
    }
  } catch (e) {
    return [e, tree, null, null, null];
  }
  let [type, _] = type_table[elaborated.id];
  let type_str = pretty_type(type);

  // Desugar.
  let sugarfree = desugar(elaborated, type_table);

  // Execute.
  let res_str: string;
  let jscode: string = null;
  if (mode === "interp") {
    // Interpret.
    let res: Value;
    try {
      res = interpret(sugarfree);
    } catch (e) {
      return ['interpreter error: ' + e, sugarfree, type_str, null, null];
    }
    res_str = pretty_value(res);

  } else {
    // Compile.
    try {
      if (mode === "webgl") {
        let ir = semantically_analyze(sugarfree, type_table, WEBGL_INTRINSICS);
        jscode = webgl_compile(ir);
      } else {
        let ir = semantically_analyze(sugarfree, type_table);
        jscode = jscompile(ir);
      }
    } catch (e) {
      return ['compile error: ' + e, sugarfree, type_str, null, null];
    }

    // Execute.
    let runtime = JS_RUNTIME + "\n";
    if (mode === "webgl") {
      runtime += WEBGL_RUNTIME + "\n";
    }

    if (mode === "webgl") {
      // TODO
      res_str = "";
    } else {
      let res = scope_eval(runtime + jscode);
      res_str = pretty_js_value(res);
    }
  }

  // Show the result value.
  return [
    null,
    sugarfree,
    type_str,
    jscode,
    res_str,
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

function decode_hash(s: string): { [key: string]: string } {
  if (s[0] === "#") {
    s = s.slice(1);
  }

  let out: { [key: string]: string } = {};
  for (let part of s.split('&')) {
    let [key, value] = part.split('=');
    out[decodeURIComponent(key)] = decodeURIComponent(value);
  }
  return out;
}

function encode_hash(obj: { [key: string]: string }): string {
  let parts: string[] = [];
  for (let key in obj) {
    let value = obj[key];
    if (value !== undefined && value !== null && value !== "") {
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
    }
  }
  return '#' + parts.join('&');
}

document.addEventListener("DOMContentLoaded", function () {
  let codebox = <HTMLTextAreaElement> document.querySelector('textarea');
  let errbox = <HTMLElement> document.querySelector('#error');
  let treebox = <HTMLElement> document.querySelector('#tree');
  let compiledbox = <HTMLElement> document.querySelector('#compiled');
  let typebox = <HTMLElement> document.querySelector('#type');
  let outbox = <HTMLElement> document.querySelector('#result');
  let helpbox = <HTMLElement> document.querySelector('#help');
  let clearbtn = <HTMLElement> document.querySelector('#clear');
  let examples = document.querySelectorAll('.example');
  let modeselect = <HTMLSelectElement> document.querySelector('#mode');

  let draw_tree = tree_canvas('#tree', get_name, get_children);

  function code_value() {
    return codebox.value.trim();
  }

  function run_code() {
    let code = code_value();
    let mode = modeselect.value;

    if (code !== "") {
      let [err, tree, typ, compiled, res] = atw_run(code, mode);

      show(err, errbox);
      show(typ, typebox);
      show(res, outbox);

      if (mode !== "interp") {
        // Show the compiled code.
        show(compiled, compiledbox);
        treebox.style.display = 'none';
      } else {
        // Draw the syntax tree.
        draw_tree(tree);
        show(null, compiledbox);
        treebox.style.display = 'block';
      }

      let hash = encode_hash({code: code, mode: mode});
      history.replaceState(null, null, hash);
    } else {
      show(null, errbox);
      show(null, typebox);
      show(null, outbox);
      treebox.style.display = 'none';
      show(null, compiledbox);

      history.replaceState(null, null, '#');
    }
  }

  function handle_hash() {
    let values = decode_hash(location.hash);

    if (values['code'] !== undefined) {
      codebox.value = values['code'];
    } else {
      codebox.value = '';
    }

    if (values['mode'] !== undefined) {
      modeselect.value = values['mode'];
    }

    run_code();
  }

  // Execute code by linking to it (pushing onto the history).
  function link_to_code(code: string, mode: string = null) {
    let hash = encode_hash({code: code, mode: mode});
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

  // Also run the code when toggling the compile checkbox.
  modeselect.addEventListener('change', function () {
    run_code();
  });

  // Example clicks load code.
  // Using a function here because JavaScript scoping is so sad.
  function add_example_handler(ex: HTMLElement) {
    ex.addEventListener('click', function () {
      link_to_code(ex.textContent, ex.dataset['mode']);
    });
  }
  for (let i = 0; i < examples.length; ++i) {
    add_example_handler(<HTMLElement> examples[i]);
  }

  // Handle the "clear" button.
  clearbtn.addEventListener('click', function () {
    if (code_value() != '') {
      link_to_code('');
    }
  });

  // Handle the empty hash and any new ones that are set.
  window.addEventListener('hashchange', function () {
    handle_hash();
  });
  handle_hash();
});
