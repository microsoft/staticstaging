/// <reference path="ast.ts" />
/// <reference path="visit.ts" />
/// <reference path="util.ts" />

type ASTFold <T> = (tree:SyntaxNode, p: T) => T;
function ast_fold_rules <T> (fself: ASTFold<T>): ASTVisit<T, T> {
  return {
    visit_literal(tree: LiteralNode, p: T): T {
      return p;
    },

    visit_seq(tree: SeqNode, p: T): T {
      let p1 = fself(tree.lhs, p);
      let p2 = fself(tree.rhs, p1);
      return p2;
    },

    visit_let(tree: LetNode, p: T): T {
      return fself(tree.expr, p);
    },

    visit_lookup(tree: LookupNode, p: T): T {
      return p;
    },

    visit_binary(tree: BinaryNode, p: T): T {
      let p1 = fself(tree.lhs, p);
      let p2 = fself(tree.rhs, p1);
      return p2;
    },

    visit_quote(tree: QuoteNode, p: T): T {
      return fself(tree.expr, p);
    },

    visit_escape(tree: EscapeNode, p: T): T {
      return fself(tree.expr, p);
    },

    visit_run(tree: RunNode, p: T): T {
      return fself(tree.expr, p);
    },

    visit_fun(tree: FunNode, p: T): T {
      return fself(tree.body, p);
    },

    visit_call(tree: CallNode, p: T): T {
      let p1 = p;
      for (let arg of tree.args) {
        p1 = fself(arg, p1);
      }
      let p2 = fself(tree.fun, p1);
      return p2;
    },

    visit_persist(tree: PersistNode, p: T): T {
      return p;
    },
  };
}

// The main output of def/use analysis: For every lookup node ID, a defining
// node ID and a flag indicating whether the variable is bound (vs. free).
type DefUseTable = [number, boolean][];

// The intermediate data structure for def/use analysis is a *stack of stack
// of maps*. The map assigns a defining node ID for names. We need a stack to
// reflect function scopes, and a stack of *those* to reflect quotes.
type NameMap = { [name: string]: number };
type NameStack = NameMap[][];

// Get the head of the head of a NameStack.
function ns_hd <T> (a: T[][]): T {
  return hd(hd(a));
}

// Like overlay, but works on the top-top of a NameStack.
function ns_overlay <T> (a: T[][]): T[][] {
  let ha = hd(a).slice(0);
  let hm = overlay(hd(ha));
  return cons(cons(hm, tl(ha)), tl(a));
}

// Create an overlay *function* scope in the top stack of a NameStack.
function ns_push_scope(ns: NameStack): NameStack {
  let top_stack = cons(<NameMap> {}, hd(ns));
  return cons(top_stack, tl(ns));
}

// Look up a value from any function scope in the top quote scope. Return the
// value and the index (in *function* scopes) where the value was found.
function ns_lookup (a: NameStack, key: string): [number, number] {
  return stack_lookup(hd(a), key);
}

// Here's the core def/use analysis.
type FindDefUse = ASTFold<[NameStack, DefUseTable]>;
function gen_find_def_use(fself: FindDefUse): FindDefUse {
  let fold_rules = ast_fold_rules(fself);
  let rules = compose_visit(fold_rules, {
    // The "let" case defines a variable in a map to refer to the "let" node.
    visit_let(tree: LetNode, [ns, table]: [NameStack, DefUseTable]):
      [NameStack, DefUseTable]
    {
      let [n1, t1] = fself(tree.expr, [ns, table]);
      let n2 = ns_overlay(n1);
      ns_hd(n2)[tree.ident] = tree.id;
      return [n2, t1];
    },

    // Similarly, "fun" defines variables in the map for its parameters.
    visit_fun(tree: FunNode, [ns, table]: [NameStack, DefUseTable]):
      [NameStack, DefUseTable]
    {
      // Update the top map with the function parameters.
      let n = ns_push_scope(ns);
      for (let param of tree.params) {
        ns_hd(n)[param.name] = param.id;
      }

      // Traverse the body with this new map.
      let [n2, t2] = fself(tree.body, [n, table]);
      // Then continue outside of the `fun` with the old map.
      return [ns, t2];
    },

    // Lookup (i.e., a use) populates the def/use table based on the name map.
    visit_lookup(tree: LookupNode,
      [ns, table]: [NameStack, DefUseTable]):
      [NameStack, DefUseTable]
    {
      let [def_id, scope_index] = ns_lookup(ns, tree.ident);
      if (def_id === undefined) {
        throw "error: variable not in name map";
      }

      // The variable is bound (as opposed to free) if it is found in the
      // topmost function scope.
      let bound = (scope_index === 0);

      let t = table.slice(0);
      t[tree.id] = [def_id, bound];
      return [ns, t];
    },

    // On quote, push an empty name map stack.
    visit_quote(tree: QuoteNode, [ns, table]: [NameStack, DefUseTable]):
      [NameStack, DefUseTable]
    {
      // Traverse inside the quote using a new, empty name map stack.
      let n = cons([<NameMap> {}], ns);
      let [_, t] = fold_rules.visit_quote(tree, [n, table]);
      // Then throw away the name map stack but preserve the updated table.
      return [ns, t];
    },

    // And pop on escape.
    visit_escape(tree: EscapeNode,
      [ns, table]: [NameStack, DefUseTable]):
      [NameStack, DefUseTable]
    {
      // Temporarily pop the current quote's scope.
      let n = tl(ns);
      let [_, t] = fold_rules.visit_escape(tree, [n, table]);
      // Then restore the old scope and return the updated table.
      return [ns, t];
    },
  });

  return function (tree: SyntaxNode,
    [ns, table]: [NameStack, DefUseTable]):
    [NameStack, DefUseTable]
  {
    return ast_visit(rules, tree, [ns, table]);
  };
};

// Build a def/use table for lookups that links them to their corresponding
// "let" or "fun" AST nodes.
let _find_def_use = fix(gen_find_def_use);
function find_def_use(tree: SyntaxNode): DefUseTable {
  let [_, t] = _find_def_use(tree, [[[{}]], []]);
  return t;
}

// A procedure is a lambda-lifted function. It includes the original body of
// the function and the IDs of the parameters and the closed-over free
// variables used in the function.
interface Proc {
  body: ExpressionNode,
  params: number[],
  free: number[],
};

type LambdaLift = ASTFold<[number[], Proc[]]>;
function gen_lambda_lift(defuse: DefUseTable): Gen<LambdaLift> {
  return function (fself: LambdaLift): LambdaLift {
    let fold_rules = ast_fold_rules(fself);
    let rules = compose_visit(fold_rules, {
      // Collect the free variables and construct a Proc.
      visit_fun(tree: FunNode, [free, procs]: [number[], Proc[]]):
        [number[], Proc[]]
      {
        let [f, p] = fold_rules.visit_fun(tree, [free, procs]);

        let param_ids: number[] = [];
        for (let param of tree.params) {
          param_ids.push(param.id);
        }
        let proc: Proc = {
          body: tree.body,
          params: param_ids,
          free: f,
        };

        return [free, cons(proc, p)];
      },

      // Add free variables to the free set.
      visit_lookup(tree: LookupNode, [free, procs]: [number[], Proc[]]):
        [number[], Proc[]]
      {
        let [defid, is_bound] = defuse[tree.id];
        let f: number[];
        if (!is_bound) {
          f = set_add(free, defid);
        } else {
          f = free;
        }
        return [f, procs];
      },
    });

    return function (tree: SyntaxNode, [free, procs]: [number[], Proc[]]):
      [number[], Proc[]]
    {
      return ast_visit(rules, tree, [free, procs]);
    }
  }
}

function symbol_name(defid: number) {
  return 'v' + defid;
}

type JSCompile = (tree: SyntaxNode) => string;
function gen_jscompile(defuse: DefUseTable): Gen<JSCompile> {
  return function (fself: JSCompile): JSCompile {
    let compile_rules : ASTVisit<void, string> = {
      visit_literal(tree: LiteralNode, param: void): string {
        return tree.value.toString();
      },

      visit_seq(tree: SeqNode, param: void): string {
        let p1 = fself(tree.lhs);
        let p2 = fself(tree.rhs);
        return p1 + ";\n" + p2;
      },

      visit_let(tree: LetNode, param: void): string {
        // TODO should declare these at some point
        let jsvar = symbol_name(tree.id);
        return jsvar + " = " + fself(tree.expr);
      },

      visit_lookup(tree: LookupNode, param: void): string {
        let [defid, _] = defuse[tree.id];
        let jsvar = symbol_name(defid);
        return jsvar;
      },

      visit_binary(tree: BinaryNode, param: void): string {
        let p1 = fself(tree.lhs);
        let p2 = fself(tree.rhs);
        return p1 + " " + tree.op + " " + p2;
      },

      visit_quote(tree: QuoteNode, param: void): string {
        throw "unimplemented";
      },

      visit_escape(tree: EscapeNode, param: void): string {
        throw "unimplemented";
      },

      visit_run(tree: RunNode, param: void): string {
        throw "unimplemented";
      },

      visit_fun(tree: FunNode, param: void): string {
        throw "unimplemented";
      },

      visit_call(tree: CallNode, param: void): string {
        throw "unimplemented";
      },

      visit_persist(tree: PersistNode, param: void): string {
        throw "error: persist cannot appear in source";
      },
    }

    return function(tree: SyntaxNode): string {
      return ast_visit(compile_rules, tree, null);
    };
  }
}

function jscompile(tree: SyntaxNode): string {
  let table = find_def_use(tree);

  let _lambda_lift = fix(gen_lambda_lift(table));
  let procs = _lambda_lift(tree, [[], []]);

  let _jscompile = fix(gen_jscompile(table));
  return _jscompile(tree);
}
