/// <reference path="ast.ts" />
/// <reference path="visit.ts" />
/// <reference path="util.ts" />

type ASTFold <T> = (tree:SyntaxNode, p: T) => T;
function gen_ast_fold <T> (fself: ASTFold<T>): ASTFold<T> {
  let fold_rules : ASTVisit<T, T> = {
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
  }

  return function(tree: SyntaxNode, p: T): T {
    return ast_visit(fold_rules, tree, p);
  };
}

// Like overlay, but works on the head of a stack.
function hd_overlay <T> (a: T[]): T[] {
  let h = overlay(hd(a));
  return cons(h, tl(a));
}

type DefUseTable = number[];
type DefUseNameMap = { [name: string]: number };
type FindDefUse = ASTFold<[DefUseNameMap[], DefUseTable]>;
function gen_find_def_use(fsuper: FindDefUse): FindDefUse {
  let rules = complete_visit(fsuper, {
    visit_let(tree: LetNode, [map, table]: [DefUseNameMap[], DefUseTable]): [DefUseNameMap[], DefUseTable] {
      // TODO also fself here
      let [m1, t1] = fsuper(tree.expr, [map, table]);
      let m2 = hd_overlay(m1);
      hd(m2)[tree.ident] = tree.id;
      return [m2, t1];
    },

    visit_lookup(tree: LookupNode, [map, table]: [DefUseNameMap[], DefUseTable]): [DefUseNameMap[], DefUseTable] {
      let def_id = hd(map)[tree.ident];
      if (def_id === undefined) {
        throw "error: variable not in name map";
      }

      let t = table.slice(0);
      t[tree.id] = def_id;
      return [map, t];
    },

    visit_fun(tree: FunNode, [map, table]: [DefUseNameMap[], DefUseTable]): [DefUseNameMap[], DefUseTable] {
      let m = hd_overlay(map);
      for (let param of tree.params) {
        hd(m)[param.name] = tree.id;
      }

      // TODO should call "fself", not "fsuper", somehow
      let [m2, t2] = fsuper(tree.body, [m, table]);
      return [m2, t2];
    },

    // TODO push & pop on quote & escape
  });

  return function (tree: SyntaxNode, [map, table]: [DefUseNameMap[], DefUseTable]): [DefUseNameMap[], DefUseTable] {
    return ast_visit(rules, tree, [map, table]);
  };
};

// Build a def/use table for lookups that links them to their corresponding
// "let" or "fun" AST nodes.
let _find_def_use = fix(compose(gen_find_def_use, gen_ast_fold));
function find_def_use(tree: SyntaxNode): DefUseTable {
  let [_, t] = _find_def_use(tree, [[{}], []]);
  return t;
}

type JSCompile = (tree: SyntaxNode) => string;
function gen_jscompile(fself: JSCompile): JSCompile {
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
      throw "unimplemented";
    },

    visit_lookup(tree: LookupNode, param: void): string {
      throw "unimplemented";
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

let jscompile = fix(gen_jscompile);
