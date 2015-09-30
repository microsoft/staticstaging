/// <reference path="ast.ts" />
/// <reference path="visit.ts" />
/// <reference path="util.ts" />

type DefUseTable = number[];
type DefUseNameMap = { [name: string]: number };
type FindDefUse = (tree: SyntaxNode, defs: DefUseNameMap) => [DefUseNameMap, DefUseTable];
function gen_defuse(fself: FindDefUse): FindDefUse {
  let def_use_rules : ASTVisit<DefUseNameMap, [DefUseNameMap, DefUseTable]> = {
    visit_literal(tree: LiteralNode, defs: DefUseNameMap): [DefUseNameMap, DefUseTable] {
      return [defs, []];
    },

    visit_seq(tree: SeqNode, defs: DefUseNameMap): [DefUseNameMap, DefUseTable] {
      let [m1, t1] = fself(tree.lhs, defs);
      let [m2, t2] = fself(tree.lhs, m1);
      return [m2, t2];
    },

    visit_let(tree: LetNode, defs: DefUseNameMap): [DefUseNameMap, DefUseTable] {
      throw "unimplemented";
    },

    visit_lookup(tree: LookupNode, defs: DefUseNameMap): [DefUseNameMap, DefUseTable] {
      throw "unimplemented";
    },

    visit_binary(tree: BinaryNode, defs: DefUseNameMap): [DefUseNameMap, DefUseTable] {
      let [m1, t1] = fself(tree.lhs, defs);
      let [m2, t2] = fself(tree.lhs, m1);
      return [m2, t2];
    },

    visit_quote(tree: QuoteNode, defs: DefUseNameMap): [DefUseNameMap, DefUseTable] {
      throw "unimplemented";
    },

    visit_escape(tree: EscapeNode, defs: DefUseNameMap): [DefUseNameMap, DefUseTable] {
      throw "unimplemented";
    },

    visit_run(tree: RunNode, defs: DefUseNameMap): [DefUseNameMap, DefUseTable] {
      throw "unimplemented";
    },

    visit_fun(tree: FunNode, defs: DefUseNameMap): [DefUseNameMap, DefUseTable] {
      throw "unimplemented";
    },

    visit_call(tree: CallNode, defs: DefUseNameMap): [DefUseNameMap, DefUseTable] {
      throw "unimplemented";
    },

    visit_persist(tree: PersistNode, defs: DefUseNameMap): [DefUseNameMap, DefUseTable] {
      throw "error: persist cannot appear in source";
    },
  }

  return function(tree: SyntaxNode): [DefUseNameMap, DefUseTable] {
    return ast_visit(def_use_rules, tree, {});
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
