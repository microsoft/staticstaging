/// <reference path="../src/driver.ts" />

declare var parser : any;
declare function tree_canvas (
  where: string,
  get_name: (_:any) => string,
  get_children: (_:any) => any[]
): (tree_data: any) => void;

declare function start_gl(container: HTMLElement, code: string): void;
declare const ATW_EXAMPLES: { [key: string]: string }[];

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
  visit_unary(tree: UnaryNode, _: void): SyntaxNode[] {
    return [tree.expr];
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
    return "var " + tree.ident;
  },
  visit_assign(tree: LetNode, _: void): string {
    return tree.ident + " =";
  },
  visit_lookup(tree: LookupNode, _: void): string {
    return tree.ident;
  },
  visit_unary(tree: UnaryNode, _: void): string {
    return tree.op;
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

const GL_PREAMBLE = `
# Externs for the dingus parameter matrices.
extern dingus.projection: Mat4;
extern dingus.view: Mat4;

# And local bindings, to make them non-pervasive.
var projection = dingus.projection;
var view = dingus.view;

# Sample assets to play with.
extern bunny: Mesh;
extern teapot: Mesh;

# Mesh asset wrangling.
extern mesh_indices: Mesh -> (Int3 Array);
extern mesh_positions: Mesh -> (Float3 Array);
extern mesh_normals: Mesh -> (Float3 Array);
extern mesh_size: Mesh -> Int;
extern draw_mesh: (Int3 Array) Int -> Void;

# Matrix manipulation library.
extern mat4.create: -> Mat4;
extern mat4.rotate: Mat4 Mat4 Float Vec3 -> Void;
extern mat4.rotateX: Mat4 Mat4 Float -> Void;
extern mat4.rotateY: Mat4 Mat4 Float -> Void;
extern mat4.rotateZ: Mat4 Mat4 Float -> Void;
extern mat4.scale: Mat4 Mat4 Vec3 -> Void;
extern mat4.translate: Mat4 Mat4 Vec3 -> Void;
extern mat4.transpose: Mat4 Mat4 -> Void;
extern mat4.scale: Mat4 Mat4 Vec3 -> Void;

extern Date.now: -> Float;
extern Math.sin: Float -> Float;
extern Math.cos: Float -> Float;
`;

// Run code and return:
// - an error, if any
// - the parse tree
// - the type
// - the compiled code (if compiling)
// - the result of interpretation or execution
// - the complete WebGL code (if in WebGL mode)
// The mode can be "interp", "compile", or "webgl".
function atw_run(code: string, mode: string)
  : [string, SyntaxNode, string, string, string, string]
{
  // Configure the driver to store a bunch of results.
  let error: string = null;
  let type: string = null;
  let config: DriverConfig = {
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
    code = GL_PREAMBLE + code;
  }

  // Run the driver.
  let res: string = null;
  let jscode: string = null;
  let ast: SyntaxNode = null;
  let glcode: string = null;
  driver_frontend(config, code, null, function (tree, types) {
    ast = tree;

    if (mode === "interp") {
      // Interpreter.
      driver_interpret(config, tree, types, function (r) {
        res = r;
      });

    } else {
      // Compiler.
      driver_compile(config, tree, types, function (code) {
        jscode = code;
        if (mode === "webgl") {
          glcode = driver_full_code(config, jscode);
        } else {
          driver_execute(config, code, function (r) {
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
  let exampleselect = <HTMLSelectElement> document.querySelector('#example');

  let draw_tree: (tree_data: any) => void;

  function code_value() {
    return codebox.value.trim();
  }

  function run_code(navigate=true) {
    let code = code_value();
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
          draw_tree = tree_canvas('#tree', get_name, get_children);
        }
        draw_tree(tree);
        show(null, compiledbox);
        treebox.style.display = 'block';
      }

      if (mode === "webgl" && glcode) {
        // Start the WebGL viewer.
        console.log(glcode);
        outbox.textContent = '';
        outbox.style.display = 'block';
        outbox.classList.add("visual");
        start_gl(outbox, glcode);
      } else {
        // Just show the output value.
        outbox.classList.remove("visual");
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
    let example_filename: string = values['example'];
    let code: string = null;
    let mode: string = null;
    if (example_filename) {
      for (let example of ATW_EXAMPLES) {
        if (example['filename'] === example_filename) {
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
      codebox.value = code;
    } else {
      codebox.value = '';
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
  function link_to_example(filename: string) {
    let hash = encode_hash({example: filename});
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

  // Populate the example popup.
  for (let i = 0; i < ATW_EXAMPLES.length; ++i) {
    let example = ATW_EXAMPLES[i];
    let option = document.createElement("option");
    option.value = i.toString();
    option.text = example['name'];
    exampleselect.appendChild(option);
  }

  // Handle example choices.
  exampleselect.addEventListener('change', function () {
    // Load the example.
    let index = parseInt(exampleselect.value);
    if (!isNaN(index)) {
      let example = ATW_EXAMPLES[index];
      link_to_example(example['filename']);

      // Switch back to the "choose an example" item.
      exampleselect.value = 'choose';
    }
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
