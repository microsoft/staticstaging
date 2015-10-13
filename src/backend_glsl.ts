/// <reference path="visit.ts" />
/// <reference path="util.ts" />
/// <reference path="compile.ts" />

type GLSLCompile = (tree: SyntaxNode) => string;
function gen_glslcompile(procs: Proc[], progs: Prog[],
  defuse: DefUseTable): Gen<GLSLCompile>
{
  return function (fself: GLSLCompile): GLSLCompile {
    let compile_rules : ASTVisit<void, string> = {
      visit_literal(tree: LiteralNode, param: void): string {
        return tree.value.toString();
      },

      visit_seq(tree: SeqNode, param: void): string {
        throw "unimplemented";
      },

      visit_let(tree: LetNode, param: void): string {
        throw "unimplemented";
      },

      visit_lookup(tree: LookupNode, param: void): string {
        throw "unimplemented";
      },

      visit_binary(tree: BinaryNode, param: void): string {
        throw "unimplemented";
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

    };

    return function(tree: SyntaxNode): string {
      return ast_visit(compile_rules, tree, null);
    };
  };
}
