/// <reference path="ast.ts" />
/// <reference path="visit.ts" />
/// <reference path="util.ts" />

// Dynamic syntax.

type Value = number | Code | Fun;

interface Env {
  [key: string]: Value;
}

class Code {
  constructor(public expr: ExpressionNode) {}
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
let Interp : ASTVisit<Env, [Value, Env]> = {
  visit_literal(tree: LiteralNode, env: Env): [Value, Env] {
    return [tree.value, env];
  },

  visit_seq(tree: SeqNode, env: Env): [Value, Env] {
    let [v, e] = interp(tree.lhs, env);
    return interp(tree.rhs, e);
  },

  visit_let(tree: LetNode, env: Env): [Value, Env] {
    let [v, e] = interp(tree.expr, env);
    // Abuse prototypes to create an overlay environment.
    let e2 = <Env> Object.create(e);
    e2[tree.ident] = v;
    return [v, e2];
  },

  visit_lookup(tree: LookupNode, env: Env): [Value, Env] {
    let v = env[tree.ident];
    if (v === undefined) {
      throw "error: undefined variable " + tree.ident;
    }
    return [v, env];
  },

  visit_quote(tree: RunNode, env: Env): [Value, Env] {
    // Jump to any escapes and execute them.
    let [t, e] = quote_interp(tree.expr, 1, env);
    // Wrap the resulting AST as a code value.
    return [new Code(t), e];
  },

  visit_escape(tree: EscapeNode, env: Env): [Value, Env] {
    throw "error: top-level escape";
  },

  visit_run(tree: RunNode, env: Env): [Value, Env] {
    let [v, e] = interp(tree.expr, env);
    if (v instanceof Code) {
      // Fresh environment for now.
      let res = interpret(v.expr);
      return [res, env];
    } else {
      throw "error: tried to run non-code value";
    }
  },

  visit_binary(tree: BinaryNode, env: Env): [Value, Env] {
    let [v1, e1] = interp(tree.lhs, env);
    let [v2, e2] = interp(tree.rhs, e1);
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

  visit_fun(tree: FunNode, env: Env): [Value, Env] {
    // Extract the parameter names.
    let param_names : string[] = [];
    for (let param of tree.params) {
      param_names.push(param.name);
    }

    // Construct a function value.
    let fun = new Fun(param_names, tree.body, env);
    return [fun, env];
  },

  visit_call(tree: CallNode, env: Env): [Value, Env] {
    // Evaluate the target expression to a function value.
    let [target, e] = interp(tree.fun, env);
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
      [arg, e] = interp(arg_expr, e);
      call_env[param_name] = arg;
    }

    // Evaluate the function body. Throw away any updates it makes to its
    // environment.
    let [ret, _] = interp(fun.body, call_env);

    return [ret, e];
  },
}

function interp(tree: SyntaxNode, env: Env): [Value, Env] {
  return ast_visit(Interp, tree, env);
}

// A second set of rules applies inside at least one quote. We keep track of
// the current level while walking the tree, searching for escapes that bring
// us back down to level 0. When this happens, we switch back to the first
// rule set.
let QuoteInterp : ASTVisit<[number, Env], [SyntaxNode, Env]> = {
  // The `quote` and `escape` cases are the only interesting ones. We
  // increment/decrement the stage number and (when the stage gets back down
  // to zero) swap back to normal interpretation.

  // Just increment the stage further.
  visit_quote(tree: QuoteNode, [stage, env]: [number, Env]):
      [SyntaxNode, Env] {
    let s = stage + 1;  // Recurse at a deeper stage.
    let [t, e] = quote_interp(tree.expr, s, env);
    return [merge(tree, { expr: t }), e];
  },

  // Decrement the stage and either swap back or just keep recursing.
  visit_escape(tree: EscapeNode, [stage, env]: [number, Env]):
      [SyntaxNode, Env] {
    let s = stage - 1;  // The escaped expression runs "up" one stage.
    if (s == 0) {
      // Escaped back out of the top-level quote! Evaluate and splice.
      let [v, e] = interp(tree.expr, env);
      // The resulting expression must be a quote we can splice.
      if (v instanceof Code) {
        return [v.expr, e];
      } else {
        throw "error: escape produced non-code value " + v;
      }
    } else {
      // Keep going.
      let [t, e] = quote_interp(tree.expr, s, env);
      return [merge(tree, { expr: t }), e];
    }
  },

  // The rest of the cases are boring: just copy the input tree and recurse
  // while threading through the stage and environment parameters. I would
  // *really* like to put this recursion in a library, but I haven't yet found
  // a clean way to do so.

  visit_literal(tree: LiteralNode, [stage, env]: [number, Env]):
      [SyntaxNode, Env] {
    return [merge(tree), env];
  },

  visit_seq(tree: SeqNode, [stage, env]: [number, Env]): [SyntaxNode, Env] {
    let [t1, e1] = quote_interp(tree.lhs, stage, env);
    let [t2, e2] = quote_interp(tree.rhs, stage, e1);
    return [merge(tree, { lhs: t1, rhs: t2 }), e2];
  },

  visit_let(tree: LetNode, [stage, env]: [number, Env]): [SyntaxNode, Env] {
    let [t, e] = quote_interp(tree.expr, stage, env);
    return [merge(tree, { expr: t }), e];
  },

  visit_lookup(tree: LookupNode, [stage, env]: [number, Env]):
      [SyntaxNode, Env] {
    return [merge(tree), env];
  },

  visit_binary(tree: BinaryNode, [stage, env]: [number, Env]):
      [SyntaxNode, Env] {
    let [t1, e1] = quote_interp(tree.lhs, stage, env);
    let [t2, e2] = quote_interp(tree.rhs, stage, e1);
    return [merge(tree, { lhs: t1, rhs: t2 }), e2];
  },

  visit_run(tree: RunNode, [stage, env]: [number, Env]): [SyntaxNode, Env] {
    let [t, e] = quote_interp(tree.expr, stage, env);
    return [merge(tree, { expr: t }), e];
  },

  visit_fun(tree: FunNode, [stage, env]: [number, Env]): [SyntaxNode, Env] {
    let [t, e] = quote_interp(tree.body, stage, env);
    return [merge(tree, { body: t }), e];
  },

  visit_call(tree: CallNode, [stage, env]: [number, Env]): [SyntaxNode, Env] {
    let [fun_tree, e] = quote_interp(tree.fun, stage, env);
    let arg_trees : SyntaxNode[] = [];
    for (let arg in tree.args) {
      let arg_tree : SyntaxNode;
      [arg_tree, e] = quote_interp(arg, stage, e);
      arg_trees.push(arg_tree);
    }
    return [merge(tree, { fun: fun_tree, args: arg_trees }), e];
  }
}

function quote_interp(tree: SyntaxNode, stage: number, env: Env):
    [SyntaxNode, Env] {
  return ast_visit(QuoteInterp, tree, [stage, env]);
}

// Helper to execute to a value in an empty initial environment.
function interpret(program: SyntaxNode): Value {
  let [v, e] = interp(program, {});
  return v;
}
