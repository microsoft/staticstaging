/// <reference path="ast.ts" />
/// <reference path="visit.ts" />
/// <reference path="util.ts" />

// Dynamic syntax.

type Value = number | Code | Fun;

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
    public env: Env
  ) {}
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
    // Abuse prototypes to create an overlay environment.
    let e2 = <Env> Object.create(e);
    e2[tree.ident] = v;
    return [v, e2];
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
      // Execute the code in a fresh environment, with its persists.
      let res = interpret(v.expr, /* pers */ v.pers);
      return [res, env];
    } else {
      throw "error: tried to run non-code value";
    }
  },

  visit_binary(tree: BinaryNode, [env, pers]: [Env, Pers]): [Value, Env] {
    let [v1, e1] = interp(tree.lhs, env, pers);
    let [v2, e2] = interp(tree.rhs, e1, pers);
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
      throw "error: non-numeric operands to operator";
    }
  },

  visit_fun(tree: FunNode, [env, pers]: [Env, Pers]): [Value, Env] {
    // Extract the parameter names.
    let param_names : string[] = [];
    for (let param of tree.params) {
      param_names.push(param.name);
    }

    // Construct a function value.
    let fun = new Fun(param_names, tree.body, env);
    return [fun, env];
  },

  visit_call(tree: CallNode, [env, pers]: [Env, Pers]): [Value, Env] {
    // Evaluate the target expression to a function value.
    let [target, e] = interp(tree.fun, env, pers);
    let fun : Fun;
    if (target instanceof Fun) {
      fun = target;
    } else {
      throw "error: call of non-function value";
    }

    // Evaluate the arguments. Bind the function parameters and overlay them
    // on the function's closed environment.
    let call_env : Env = overlay(fun.env);
    for (let i = 0; i < tree.args.length; ++i) {
      let arg_expr = tree.args[i];
      let param_name = fun.params[i];
      let arg : Value;
      [arg, e] = interp(arg_expr, e, pers);
      call_env[param_name] = arg;
    }

    // Evaluate the function body. Throw away any updates it makes to its
    // environment.
    let [ret, _] = interp(fun.body, call_env, pers);

    return [ret, e];
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
          return [v.expr, e, pers];
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
  // while threading through the stage and environment parameters. I would
  // *really* like to put this recursion in a library, but I haven't yet found
  // a clean way to do so.

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

  visit_lookup(tree: LookupNode, [stage, env, pers, opers]: [number, Env, Pers, Pers]):
      [SyntaxNode, Env, Pers] {
    return [merge(tree), env, pers];
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

// Helper to execute to a value in an empty initial environment.
function interpret(program: SyntaxNode, pers: Pers = []): Value {
  let [v, e] = interp(program, {}, pers);
  return v;
}
