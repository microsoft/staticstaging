/// <reference path="ast.ts" />
/// <reference path="visit.ts" />
/// <reference path="util.ts" />
/// <reference path="pretty.ts" />

// Dynamic syntax.

type Value = number | Code | Fun | Extern;

interface Env {
  [key: string]: Value;
}

type Pers = Value[];
class Code {
  constructor(
    public expr: ExpressionNode,
    // The Pers is a Code value's equivalent of a closure's environment. It is
    // a list of values associated with the Persist nodes in the expression.
    public pers: Pers
  ) {}
}

class Fun {
  constructor(
    public params: string[],
    public body: ExpressionNode,
    public env: Env,
    public pers: Pers  // In case the function was defined in a quote.
  ) {}
}

// A marker for values from the external world. This helps with two
// extern-related issues:
// - We need to invoke functions with a different "calling convention".
// - Assignments work differently.
class Extern {
  constructor(
    public name: string
  ) {}
}

function unwrap_extern(v: Value): Value {
  if (v instanceof Extern) {
    return eval(v.name);
  } else {
    return v;
  }
}


// Dynamic semantics rules.

// This first set of rules applies at the "top level", for ordinary execution.
// Escapes are not allowed at this level. At a quote, we transition to a
// different set of rules.
let Interp : ASTVisit<[Env, Pers], [Value, Env]> = {
  visit_literal(tree: LiteralNode, [env, pers]: [Env, Pers]): [Value, Env] {
    return [tree.value, env];
  },

  visit_seq(tree: SeqNode, [env, pers]: [Env, Pers]): [Value, Env] {
    let [v, e] = interp(tree.lhs, env, pers);
    return interp(tree.rhs, e, pers);
  },

  visit_let(tree: LetNode, [env, pers]: [Env, Pers]): [Value, Env] {
    let [v, e] = interp(tree.expr, env, pers);
    let e2 = overlay(e);  // Update the value in an overlay.
    e2[tree.ident] = v;
    return [v, e2];
  },

  visit_assign(tree: AssignNode, [env, pers]: [Env, Pers]): [Value, Env] {
    let [v, e] = interp(tree.expr, env, pers);

    // Check whether we have an extern or a normal variable by looking at the
    // current value.
    let old_value = env[tree.ident];
    if (old_value instanceof Extern) {
      // Update the external value.
      let f = eval("(function(value) { " + old_value.name + " = value })");
      f(v);
      return [v, e];
    } else {
      // Ordinary variable assignment.
      let e2 = overlay(e);
      e2[tree.ident] = v;
      return [v, e2];
    }
  },

  visit_lookup(tree: LookupNode, [env, pers]: [Env, Pers]): [Value, Env] {
    let v = env[tree.ident];
    if (v === undefined) {
      throw "error: undefined variable " + tree.ident;
    }
    return [v, env];
  },

  visit_quote(tree: RunNode, [env, pers]: [Env, Pers]): [Value, Env] {
    // Jump to any escapes and execute them.
    let [t, e, p] = quote_interp(tree.expr, 1, env, [], pers);
    // Wrap the resulting AST as a code value.
    return [new Code(t, p), e];
  },

  visit_escape(tree: EscapeNode, [env, pers]: [Env, Pers]): [Value, Env] {
    throw "error: top-level escape";
  },

  visit_run(tree: RunNode, [env, pers]: [Env, Pers]): [Value, Env] {
    let [v, e] = interp(tree.expr, env, pers);
    if (v instanceof Code) {
      // Execute the code. In order to carry along the `extern` intrinsics, we
      // include the current environment even though quoted code is
      // *ordinarily* prohibited from looking up values in it.
      let res = interpret(v.expr, e, v.pers);
      return [res, env];
    } else {
      throw "error: tried to run non-code value";
    }
  },

  visit_unary(tree: UnaryNode, [env, pers]: [Env, Pers]): [Value, Env] {
    let [v, e] = interp(tree.expr, env, pers);
    v = unwrap_extern(v);
    if (typeof v === 'number') {
      let out: Value;
      switch (tree.op) {
        case "+":
          out = +v; break;
        case "-":
          out = -v; break;
        default:
          throw "error: unknown unary operator " + tree.op;
      }
      return [out, e];
    } else {
      throw "error: non-numeric operand to unary operator";
    }
  },

  visit_binary(tree: BinaryNode, [env, pers]: [Env, Pers]): [Value, Env] {
    let [v1, e1] = interp(tree.lhs, env, pers);
    let [v2, e2] = interp(tree.rhs, e1, pers);
    v1 = unwrap_extern(v1);
    v2 = unwrap_extern(v2);
    if (typeof v1 === 'number' && typeof v2 === 'number') {
      let v: Value;
      switch (tree.op) {
        case "+":
          v = v1 + v2; break;
        case "-":
          v = v1 - v2; break;
        case "*":
          v = v1 * v2; break;
        case "/":
          v = v1 / v2; break;
        default:
          throw "error: unknown binary operator " + tree.op;
      }
      return [v, e2];
    } else {
      throw "error: non-numeric operands to binary operator";
    }
  },

  visit_fun(tree: FunNode, [env, pers]: [Env, Pers]): [Value, Env] {
    // Extract the parameter names.
    let param_names : string[] = [];
    for (let param of tree.params) {
      param_names.push(param.name);
    }

    // Construct a function value.
    let fun = new Fun(param_names, tree.body, env, pers);
    return [fun, env];
  },

  visit_call(tree: CallNode, [env, pers]: [Env, Pers]): [Value, Env] {
    // Evaluate the target expression to a function value.
    let [target, e] = interp(tree.fun, env, pers);

    // Evaluate the arguments.
    let args: Value[] = [];
    for (let i = 0; i < tree.args.length; ++i) {
      let arg_expr = tree.args[i];
      let arg: Value;
      [arg, e] = interp(arg_expr, e, pers);
      args.push(arg);
    }

    // Normal function.
    if (target instanceof Fun) {
      // Bind the function parameters and overlay them on the function's
      // closed environment.
      let call_env : Env = overlay(target.env);
      for (let i = 0; i < args.length; ++i) {
        let param_name = target.params[i];
        call_env[param_name] = args[i];
      }

      // Evaluate the function body. Throw away any updates it makes to its
      // environment.
      let [ret, _] = interp(target.body, call_env, target.pers);

      return [ret, e];

    // Call a "native" JavaScript function.
    } else if (target instanceof Extern) {
      let fun = eval(target.name);
      let unwrapped_args: Value[] = [];
      for (let arg of args) {
        unwrapped_args.push(unwrap_extern(arg));
      }
      let ret = fun(...unwrapped_args);
      return [ret, e];

    } else {
      throw "error: call of non-function value";
    }
  },

  visit_extern(tree: ExternNode, [env, pers]: [Env, Pers]): [Value, Env] {
    // Add the placeholder value to the environment. It may seem a little
    // messy to mix together normal variables and externs, but the type system
    // keeps them straight so we don't have to.
    let extern = new Extern(tree.expansion || tree.name);
    let e = overlay(env);
    e[tree.name] = extern;

    return [extern, e];
  },

  visit_persist(tree: PersistNode, [env, pers]: [Env, Pers]): [Value, Env] {
    if (tree.index < 0 || tree.index >= pers.length) {
      throw "error: persist index (" + tree.index +
            ") out of range (" + pers.length + ")";
    }
    let value = pers[tree.index];
    return [value, env];
  },
}

function interp(tree: SyntaxNode, env: Env, pers: Pers): [Value, Env] {
  return ast_visit(Interp, tree, [env, pers]);
}

// Add a number to every persis node in an AST. This is used when splicing
// quotes into other quotes.
function increment_persists(amount: number) {
  function fself(tree: SyntaxNode): SyntaxNode {
    let rules = compose_visit(ast_translate_rules(fself), {
      visit_persist(tree: PersistNode, param: void): SyntaxNode {
        return merge(tree, { index: tree.index + amount });
      },
    });
    return ast_visit(rules, tree, null);
  }
  return fself;
}

// A second set of rules applies inside at least one quote.
//
// We keep track of the current level while walking the tree, searching for
// escapes that bring us back down to level 0. When this happens, we switch
// back to the first rule set.
//
// Threaded through all of this, in addition to the level number, is an Env
// that can get updated every time we hit an escape. There's also a Pers,
// called `opers` for "outer" or "original", that makes up the rest of the
// outer interpreter state for when we need to resume in an escape.
//
// We also accumulate a *new* Pers, just called `pers`, which is a list of
// values produced by each *persistent* escape. The Persist nodes in the code
// contain indices into this array.
let QuoteInterp : ASTVisit<[number, Env, Pers, Pers],
                           [SyntaxNode, Env, Pers]> = {
  // The `quote` and `escape` cases are the only interesting ones. We
  // increment/decrement the stage number and (when the stage gets back down
  // to zero) swap back to normal interpretation.

  // Just increment the stage further.
  visit_quote(tree: QuoteNode,
      [stage, env, pers, opers]: [number, Env, Pers, Pers]):
      [SyntaxNode, Env, Pers] {
    let s = stage + 1;  // Recurse at a deeper stage.
    let [t, e, p] = quote_interp(tree.expr, s, env, pers, opers);
    return [merge(tree, { expr: t }), e, p];
  },

  // Decrement the stage and either swap back or just keep recursing.
  visit_escape(tree: EscapeNode,
      [stage, env, pers, opers]: [number, Env, Pers, Pers]):
      [SyntaxNode, Env, Pers] {
    let s = stage - 1;  // The escaped expression runs "up" one stage.
    if (s == 0) {
      // Escaped back out of the top-level quote! Evaluate it and integrate it
      // with the quote, either by splicing or persisting.
      let [v, e] = interp(tree.expr, env, opers);

      if (tree.kind === "splice") {
        // The resulting expression must be a quote we can splice.
        if (v instanceof Code) {
          // Renumber the persist expressions in the code to reflect its
          // position in the current context.
          let spliced = increment_persists(pers.length)(v.expr);

          // Combine the spliced code's persists with ours.
          let p = pers.concat(v.pers);

          return [spliced, e, p];
        } else {
          throw "error: escape produced non-code value " + v;
        }

      } else if (tree.kind === "persist") {
        let p = pers.concat([v]);
        let expr : PersistNode = {tag: "persist", index: p.length - 1};
        return [expr, e, p];

      } else {
        throw "error: unknown persist kind";
      }
    } else {
      // Keep going.
      let [t, e, p] = quote_interp(tree.expr, s, env, pers, opers);
      return [merge(tree, { expr: t }), e, p];
    }
  },

  // The rest of the cases are boring: just copy the input tree and recurse
  // while threading through the stage and environment parameters.
  // TODO Use the Translate machinery from the desugaring step.

  visit_literal(tree: LiteralNode,
      [stage, env, pers, opers]: [number, Env, Pers, Pers]):
      [SyntaxNode, Env, Pers] {
    return [merge(tree), env, pers];
  },

  visit_seq(tree: SeqNode,
      [stage, env, pers, opers]: [number, Env, Pers, Pers]):
      [SyntaxNode, Env, Pers] {
    let [t1, e1, p1] = quote_interp(tree.lhs, stage, env, pers, opers);
    let [t2, e2, p2] = quote_interp(tree.rhs, stage, e1, p1, opers);
    return [merge(tree, { lhs: t1, rhs: t2 }), e2, p2];
  },

  visit_let(tree: LetNode,
      [stage, env, pers, opers]: [number, Env, Pers, Pers]):
      [SyntaxNode, Env, Pers] {
    let [t, e, p] = quote_interp(tree.expr, stage, env, pers, opers);
    return [merge(tree, { expr: t }), e, p];
  },

  visit_assign(tree: AssignNode,
      [stage, env, pers, opers]: [number, Env, Pers, Pers]):
      [SyntaxNode, Env, Pers] {
    let [t, e, p] = quote_interp(tree.expr, stage, env, pers, opers);
    return [merge(tree, { expr: t }), e, p];
  },

  visit_lookup(tree: LookupNode,
      [stage, env, pers, opers]: [number, Env, Pers, Pers]):
      [SyntaxNode, Env, Pers] {
    return [merge(tree), env, pers];
  },

  visit_unary(tree: UnaryNode,
      [stage, env, pers, opers]: [number, Env, Pers, Pers]):
      [SyntaxNode, Env, Pers] {
    let [t, e, p] = quote_interp(tree.expr, stage, env, pers, opers);
    return [merge(tree, { expr: t }), e, p];
  },

  visit_binary(tree: BinaryNode,
      [stage, env, pers, opers]: [number, Env, Pers, Pers]):
      [SyntaxNode, Env, Pers] {
    let [t1, e1, p1] = quote_interp(tree.lhs, stage, env, pers, opers);
    let [t2, e2, p2] = quote_interp(tree.rhs, stage, e1, p1, opers);
    return [merge(tree, { lhs: t1, rhs: t2 }), e2, p2];
  },

  visit_run(tree: RunNode,
      [stage, env, pers, opers]: [number, Env, Pers, Pers]):
      [SyntaxNode, Env, Pers] {
    let [t, e, p] = quote_interp(tree.expr, stage, env, pers, opers);
    return [merge(tree, { expr: t }), e, p];
  },

  visit_fun(tree: FunNode,
      [stage, env, pers, opers]: [number, Env, Pers, Pers]):
      [SyntaxNode, Env, Pers] {
    let [t, e, p] = quote_interp(tree.body, stage, env, pers, opers);
    return [merge(tree, { body: t }), e, p];
  },

  visit_call(tree: CallNode,
      [stage, env, pers, opers]: [number, Env, Pers, Pers]):
      [SyntaxNode, Env, Pers] {
    let [fun_tree, e, p] = quote_interp(tree.fun, stage, env, pers, opers);
    let arg_trees : SyntaxNode[] = [];
    for (let arg in tree.args) {
      let arg_tree : SyntaxNode;
      [arg_tree, e, p] = quote_interp(arg, stage, e, p, opers);
      arg_trees.push(arg_tree);
    }
    return [merge(tree, { fun: fun_tree, args: arg_trees }), e, p];
  },

  visit_extern(tree: ExternNode,
      [stage, env, pers, opers]: [number, Env, Pers, Pers]):
      [SyntaxNode, Env, Pers] {
    return [merge(tree), env, pers];
  },

  visit_persist(tree: PersistNode,
      [stage, env, pers, opers]: [number, Env, Pers, Pers]):
      [SyntaxNode, Env, Pers] {
    throw "error: persist cannot appear in source code";
  },
}

function quote_interp(tree: SyntaxNode, stage: number, env: Env, pers: Pers,
    opers: Pers):
    [SyntaxNode, Env, Pers] {
  return ast_visit(QuoteInterp, tree, [stage, env, pers, opers]);
}

// Helper to execute to a value in an (optionally) empty initial environment.
function interpret(program: SyntaxNode, e: Env = {}, p: Pers = []): Value {
  let [v, _] = interp(program, e, p);
  return v;
}

// Format a resulting value as a string.
function pretty_value(v: Value): string {
  if (typeof v == 'number') {
    return v.toString();
  } else if (v instanceof Code) {
    return "< " + pretty(v.expr) + " >";
  } else if (v instanceof Fun) {
    return "(fun)";
  } else if (v instanceof Extern) {
    return eval(v.name).toString();
  } else {
    throw "error: unknown value kind " + typeof(v);
  }
}
