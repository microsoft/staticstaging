/// <reference path="../src/interp.ts" />
/// <reference path="../src/pretty.ts" />
/// <reference path="../src/type.ts" />
/// <reference path="../src/sugar.ts" />

declare var parser : any;
declare function tree_canvas (
  where: string,
  get_name: (_:any) => string,
  get_children: (_:any) => any[]
): (tree_data: any) => void;

const RUN_DELAY_MS = 200;
const HASH_CODE = '#code=';

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
// - the result of interpretation
function atw_run(code: string) : [string, SyntaxNode, string, string] {
  // Parse.
  let tree: SyntaxNode;
  try {
    tree = parser.parse(code);
  } catch (e) {
    let loc = e.location.start;
    let err = 'parse error at '
              + loc.line + ',' + loc.column
              + ': ' + e.message;
    return [err, null, null, null];
  }

  // Elaborate and log the type.
  let elaborated : SyntaxNode;
  let type_table : TypeTable;
  try {
    [elaborated, type_table] = elaborate(tree);
  } catch (e) {
    return [e, tree, null, null];
  }
  let [type, _] = type_table[elaborated.id];
  let type_str = pretty_type(type);

  // Desugar.
  let sugarfree = desugar(elaborated, type_table);

  // Show the result value.
  return [
    null,
    tree,
    type_str,
    pretty_value(interpret(sugarfree)),
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

  let draw_tree = tree_canvas('#tree', get_name, get_children);

  function code_value() {
    return codebox.value.trim();
  }

  function run_code() {
    let code = code_value();
    if (code !== "") {
      let [err, tree, typ, res] = atw_run(code);

      show(err, errbox);
      show(typ, typebox);
      show(res, outbox);

      // Draw the syntax tree.
      draw_tree(tree);

      history.replaceState(null, null, HASH_CODE + encodeURIComponent(code));
    } else {
      show(null, errbox);
      show(null, typebox);
      show(null, outbox);

      history.replaceState(null, null, '#');
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
