/// <reference path="ast.ts" />
/// <reference path="visit.ts" />
/// <reference path="util.ts" />

type DefUseTable = number[];
type DefUseNameMap = { [name: string]: number };
type FindDefUse = (tree: SyntaxNode, [map, table]: [DefUseNameMap, DefUseTable]) => [DefUseNameMap, DefUseTable];
function gen_defuse(fself: FindDefUse): FindDefUse {
  let def_use_rules : ASTVisit<[DefUseNameMap, DefUseTable], [DefUseNameMap, DefUseTable]> = {
    visit_literal(tree: LiteralNode, [map, table]: [DefUseNameMap, DefUseTable]): [DefUseNameMap, DefUseTable] {
      return [map, table];
    },

    visit_seq(tree: SeqNode, [map, table]: [DefUseNameMap, DefUseTable]): [DefUseNameMap, DefUseTable] {
      let [m1, t1] = fself(tree.lhs, [map, table]);
      let [m2, t2] = fself(tree.lhs, [m1, t1]);
      return [m2, t2];
    },

    visit_let(tree: LetNode, [map, table]: [DefUseNameMap, DefUseTable]): [DefUseNameMap, DefUseTable] {
      let m = merge(map);
      m[tree.ident] = tree.id;
      return [m, table];
    },

    visit_lookup(tree: LookupNode, [map, table]: [DefUseNameMap, DefUseTable]): [DefUseNameMap, DefUseTable] {
      throw "unimplemented";
    },

    visit_binary(tree: BinaryNode, [map, table]: [DefUseNameMap, DefUseTable]): [DefUseNameMap, DefUseTable] {
      let [m1, t1] = fself(tree.lhs, [map, table]);
      let [m2, t2] = fself(tree.lhs, [m1, t1]);
      return [m2, t2];
    },

    visit_quote(tree: QuoteNode, [map, table]: [DefUseNameMap, DefUseTable]): [DefUseNameMap, DefUseTable] {
      throw "unimplemented";
    },

    visit_escape(tree: EscapeNode, [map, table]: [DefUseNameMap, DefUseTable]): [DefUseNameMap, DefUseTable] {
      throw "unimplemented";
    },

    visit_run(tree: RunNode, [map, table]: [DefUseNameMap, DefUseTable]): [DefUseNameMap, DefUseTable] {
      throw "unimplemented";
    },

    visit_fun(tree: FunNode, [map, table]: [DefUseNameMap, DefUseTable]): [DefUseNameMap, DefUseTable] {
      throw "unimplemented";
    },

    visit_call(tree: CallNode, [map, table]: [DefUseNameMap, DefUseTable]): [DefUseNameMap, DefUseTable] {
      throw "unimplemented";
    },

    visit_persist(tree: PersistNode, [map, table]: [DefUseNameMap, DefUseTable]): [DefUseNameMap, DefUseTable] {
      throw "error: persist cannot appear in source";
    },
  }

  return function(tree: SyntaxNode, [map, table]: [DefUseNameMap, DefUseTable]): [DefUseNameMap, DefUseTable] {
    return ast_visit(def_use_rules, tree, [map, table]);
  };
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
