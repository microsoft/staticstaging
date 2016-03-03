/// <reference path="typings/browser.d.ts" />

import * as driver from '../src/driver';
import * as ast from '../src/ast';
import { ASTVisit, ast_visit } from '../src/visit';

import parser = require('../parser');
import CodeMirror = require('codemirror');
import { tree_canvas } from './tree';
import d3 = require('d3');

declare function start_gl(container: HTMLElement, fps_element: HTMLElement):
  (code: string) => void;
declare const ATW_EXAMPLES: { [key: string]: string }[];
declare const ATW_PREAMBLES: { [key: string]: string }[];

const RUN_DELAY_MS = 200;

let GetChildren : ASTVisit<void, ast.SyntaxNode[]> = {
  visit_literal(tree: ast.LiteralNode, _: void): ast.SyntaxNode[] {
    return [];
  },
  visit_seq(tree: ast.SeqNode, _: void): ast.SyntaxNode[] {
    return [tree.lhs, tree.rhs];
  },
  visit_let(tree: ast.LetNode, _: void): ast.SyntaxNode[] {
    return [tree.expr];
  },
  visit_assign(tree: ast.LetNode, _: void): ast.SyntaxNode[] {
    return [tree.expr];
  },
  visit_lookup(tree: ast.LookupNode, _: void): ast.SyntaxNode[] {
    return [];
  },
  visit_unary(tree: ast.UnaryNode, _: void): ast.SyntaxNode[] {
    return [tree.expr];
  },
  visit_binary(tree: ast.BinaryNode, _: void): ast.SyntaxNode[] {
    return [tree.lhs, tree.rhs];
  },
  visit_quote(tree: ast.QuoteNode, _: void): ast.SyntaxNode[] {
    return [tree.expr];
  },
  visit_escape(tree: ast.EscapeNode, _: void): ast.SyntaxNode[] {
    return [tree.expr];
  },
  visit_run(tree: ast.RunNode, _: void): ast.SyntaxNode[] {
    return [tree.expr];
  },
  visit_fun(tree: ast.FunNode, _: void): ast.SyntaxNode[] {
    return [tree.body];
  },
  visit_call(tree: ast.CallNode, _: void): ast.SyntaxNode[] {
    return [tree.fun].concat(tree.args);
  },
  visit_extern(tree: ast.ExternNode, _: void): ast.SyntaxNode[] {
    return [];
  },
  visit_persist(tree: ast.PersistNode, _: void): ast.SyntaxNode[] {
    return [];
  },
  visit_if(tree: ast.IfNode, _: void): ast.SyntaxNode[] {
    return [tree.cond, tree.truex, tree.falsex];
  },
};

function get_children(tree: ast.SyntaxNode): ast.SyntaxNode[] {
  return ast_visit(GetChildren, tree, null);
};

let GetName : ASTVisit<void, string> = {
  visit_literal(tree: ast.LiteralNode, _: void): string {
    return tree.value.toString();
  },
  visit_seq(tree: ast.SeqNode, _: void): string {
    return "seq";
  },
  visit_let(tree: ast.LetNode, _: void): string {
    return "var " + tree.ident;
  },
  visit_assign(tree: ast.LetNode, _: void): string {
    return tree.ident + " =";
  },
  visit_lookup(tree: ast.LookupNode, _: void): string {
    return tree.ident;
  },
  visit_unary(tree: ast.UnaryNode, _: void): string {
    return tree.op;
  },
  visit_binary(tree: ast.BinaryNode, _: void): string {
    return tree.op;
  },
  visit_quote(tree: ast.QuoteNode, _: void): string {
    return "quote";
  },
  visit_escape(tree: ast.EscapeNode, _: void): string {
    if (tree.kind === "persist") {
      return "persist";
    } else {
      return "escape";
    }
  },
  visit_run(tree: ast.RunNode, _: void): string {
    return "run";
  },
  visit_fun(tree: ast.FunNode, _: void): string {
    let params = "";
    for (let param of tree.params) {
      params += " " + param.name;
    }
    return "fun" + params;
  },
  visit_call(tree: ast.CallNode, _: void): string {
    return "call";
  },
  visit_extern(tree: ast.ExternNode, _: void): string {
    return "extern " + tree.name;
  },
  visit_persist(tree: ast.PersistNode, _: void): string {
    return "%" + tree.index;
  },
  visit_if(tree: ast.IfNode, _: void): string {
    return "if";
  },
}

function get_name(tree: ast.SyntaxNode): string {
  return ast_visit(GetName, tree, null);
};

// Run code and return:
// - an error, if any
// - the parse tree
// - the type
// - the compiled code (if compiling)
// - the result of interpretation or execution
// - the complete WebGL code (if in WebGL mode)
// The mode can be "interp", "compile", or "webgl".
function atw_run(code: string, mode: string)
  : [string, ast.SyntaxNode, string, string, string, string]
{
  // Configure the driver to store a bunch of results.
  let error: string = null;
  let type: string = null;
  let config: driver.Config = {
    parser: parser,
    webgl: mode === "webgl",

    log(...msg: any[]) {
      // Work around a TypeScript limitation.
      // https://github.com/Microsoft/TypeScript/issues/4759
      (console.log as any)(...msg);
    },
    error (e: string) {
      error = e;
    },

    parsed: (_ => void 0),
    typed (t: string) {
      type = t;
    },
  };

  // Add the preamble, if this is WebGL mode.
  if (mode === "webgl") {
    code = ATW_PREAMBLES[0]['body'] + code;
  }

  // Run the driver.
  let res: string = null;
  let jscode: string = null;
  let ast: ast.SyntaxNode = null;
  let glcode: string = null;
  driver.frontend(config, code, null, function (tree, types) {
    ast = tree;

    if (mode === "interp") {
      // Interpreter.
      driver.interpret(config, tree, types, function (r) {
        res = r;
      });

    } else {
      // Compiler.
      driver.compile(config, tree, types, function (code) {
        jscode = code;
        if (mode === "webgl") {
          glcode = driver.full_code(config, jscode);
        } else {
          driver.execute(config, code, function (r) {
            res = r;
          });
        }
      });
    }
  });

  return [error, ast, type, jscode, res, glcode];
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

// CodeMirror syntax mode.
CodeMirror.defineMode("alltheworld", function (config, pconfig) {
  const keywords = ["var", "def", "fun", "extern"];
  const brackets = "<>[]()";
  const punctuation = [":", "->"];
  const operators = ["+", "-", "*", "/"];
  const builtins = ["render", "vtx", "frag"];
  const quote_begin = /[A-Za-z0-9]+\</;

  return {
    startState() {
      return {
        paren_depth: 0,
      };
    },

    token(stream, state) {
      for (let keyword of keywords) {
        if (stream.match(keyword)) {
          return "keyword";
        }
      }

      for (let builtin of builtins) {
        if (stream.match(builtin)) {
          return "builtin";
        }
      }

      // Annotated quotes.
      if (stream.match(quote_begin)) {
        return "bracket";
      }

      // Single characters.
      let ch = stream.next().toString();
      if (ch === "(") {
        ++state.paren_depth;
      } else if (ch === ")") {
        --state.paren_depth;
      }

      for (let op of operators) {
        if (ch === op) {
          return "operator";
        }
      }
      if (brackets.indexOf(ch) !== -1) {
        return "bracket";
      }
      if (ch === "#") {
        stream.skipToEnd();
        return "comment";
      }
      return null;
    },

    /*
    indent(state, textAfter) {
      return
    },
    */

    lineComment: "#",
  };
});

document.addEventListener("DOMContentLoaded", function () {
  let codebox = <HTMLTextAreaElement> document.querySelector('textarea');
  let errbox = <HTMLElement> document.querySelector('#error');
  let treebox = <HTMLElement> document.querySelector('#tree');
  let compiledbox = <HTMLElement> document.querySelector('#compiled');
  let typebox = <HTMLElement> document.querySelector('#type');
  let outbox = <HTMLElement> document.querySelector('#result');
  let helpbox = <HTMLElement> document.querySelector('#help');
  let clearbtn = <HTMLElement> document.querySelector('#clear');
  let modeselect = <HTMLSelectElement> document.querySelector('#mode');
  let exampleselect = <HTMLSelectElement> document.querySelector('#example');
  let fpsbox = <HTMLElement> document.querySelector('#fps');
  let visualbox = <HTMLElement> document.querySelector('#visual');

  // Set up CodeMirror. Replace this with `null` to use an ordinary textarea.
  let codemirror = CodeMirror.fromTextArea(codebox, {
    lineNumbers: true,
    mode: "alltheworld",
  });

  // Accessors for the current code in the box.
  function get_code() {
    if (codemirror) {
      return codemirror.getDoc().getValue();
    } else {
      return codebox.value.trim();
    }
  }
  function set_code(s: string) {
    if (codemirror) {
      codemirror.getDoc().setValue(s);
    } else {
      codebox.value = s;
    }
  }

  // Event handler for changes to the code.
  let tid: any = null;
  function handle_code () {
    if (tid) {
      clearTimeout(tid);
    }
    tid = setTimeout(run_code, RUN_DELAY_MS);
  };

  if (codemirror) {
    codemirror.on('change', function (cm, change) {
      // Suppress change events from programmatic updates (to match an
      // ordinary textarea).
      if (change.origin !== "setValue") {
        handle_code();
      }
    });
  } else {
    codebox.addEventListener('change', handle_code);
  }

  // Lazily constructed tools.
  let draw_tree: (tree_data: any) => void;
  let update_gl: (code: string) => void;

  function run_code(navigate=true) {
    let code = get_code();
    let mode = modeselect.value;

    if (code !== "") {
      let [err, tree, typ, compiled, res, glcode] = atw_run(code, mode);

      show(err, errbox);
      show(typ, typebox);

      if (mode !== "interp") {
        // Show the compiled code.
        show(compiled, compiledbox);
        treebox.style.display = 'none';
      } else {
        // Draw the syntax tree.
        if (!draw_tree) {
          // Lazily initialize the drawing code to avoid D3 invocations when
          // we don't need them.
          draw_tree = tree_canvas(d3, '#tree', get_name, get_children);
        }
        draw_tree(tree);
        show(null, compiledbox);
        treebox.style.display = 'block';
      }

      if (mode === "webgl" && glcode) {
        // Start the WebGL viewer.
        visualbox.style.display = 'block';
        fpsbox.style.display = 'block';
        show(null, outbox);

        console.log(glcode);
        if (!update_gl) {
          update_gl = start_gl(visualbox, fpsbox);
        }
        update_gl(glcode);
      } else {
        // Just show the output value.
        visualbox.style.display = 'none';
        fpsbox.style.display = 'none';
        show(res, outbox);
      }

      if (navigate) {
        let hash = encode_hash({code: code, mode: mode});
        history.replaceState(null, null, hash);
      }
    } else {
      show(null, errbox);
      show(null, typebox);
      show(null, outbox);
      treebox.style.display = 'none';
      show(null, compiledbox);

      if (navigate) {
        history.replaceState(null, null, '#');
      }
    }
  }

  function handle_hash() {
    let values = decode_hash(location.hash);

    // Handle examples.
    let example_name: string = values['example'];
    let code: string = null;
    let mode: string = null;
    if (example_name) {
      for (let example of ATW_EXAMPLES) {
        if (example['name'] === example_name) {
          code = example['body'];
          mode = example['mode'];
          break;
        }
      }
    }

    // Handle ordinary inline data.
    if (values['code'] !== undefined) {
      code = values['code'];
    }
    if (values['mode'] !== undefined) {
      mode = values['mode'];
    }

    if (code) {
      set_code(code);
    } else {
      set_code('');
    }

    if (mode) {
      modeselect.value = mode;
    }

    run_code(false);
  }

  // Execute code by linking to it (pushing onto the history).
  function link_to_code(code: string, mode: string = null) {
    let hash = encode_hash({code: code, mode: mode});
    history.pushState(null, null, hash);
    handle_hash();
  }

  // Similarly, link to an example with a shorter name.
  function link_to_example(name: string) {
    let hash = encode_hash({example: name});
    history.pushState(null, null, hash);
    handle_hash();
  }

  // Also run the code when toggling the compile checkbox.
  modeselect.addEventListener('change', function () {
    run_code();
  });

  // Populate the example popup.
  for (let example of ATW_EXAMPLES) {
    let option = document.createElement("option");
    option.value = example['name'];
    option.text = example['title'];
    exampleselect.appendChild(option);
  }

  // Handle example choices.
  exampleselect.addEventListener('change', function () {
    // Load the example.
    link_to_example(exampleselect.value);

    // Switch back to the "choose an example" item.
    exampleselect.value = 'choose';
  });

  // Handle the "clear" button.
  clearbtn.addEventListener('click', function () {
    if (get_code() != '') {
      link_to_code('');
    }
  });

  // Handle the empty hash and any new ones that are set.
  window.addEventListener('hashchange', function () {
    handle_hash();
  });
  handle_hash();
});
