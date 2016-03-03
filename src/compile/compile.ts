import { ASTFold, ast_fold_rules, compose_visit, ast_visit } from '../visit';
import { fix } from '../util';
import * as ast from '../ast';
import { CompilerIR } from './ir';
import { TypeTable } from '../type_elaborate';
import { TypeMap } from '../type';
import { find_def_use, NameMap } from './defuse';
import { find_scopes } from './scope';
import { lift } from './lift';
import { presplice } from './presplice';

// Find all the `extern`s in a program.
type FindExterns = ASTFold<string[]>;
function gen_find_externs(fself: FindExterns): FindExterns {
  let fold_rules = ast_fold_rules(fself);
  let rules = compose_visit(fold_rules, {
    visit_extern(tree: ast.ExternNode, externs: string[]): string[] {
      let e = externs.slice(0);
      e[tree.id] = tree.expansion || tree.name;
      return e;
    }
  });
  return function (tree: ast.SyntaxNode, externs: string[]): string[] {
    return ast_visit(rules, tree, externs);
  };
}
let find_externs = fix(gen_find_externs);

// This is the semantic analysis that produces our mid-level IR given an
// elaborated, desugared AST.
export function semantically_analyze(tree: ast.SyntaxNode,
  type_table: TypeTable,
  intrinsics: TypeMap = {}): CompilerIR
{
  // Give IDs to the intrinsics and add them to the type table.
  let intrinsics_map: NameMap = {};
  for (let name in intrinsics) {
    let id = type_table.length;
    type_table[id] = [intrinsics[name], null];
    intrinsics_map[name] = id;
  }

  // Use the current intrinsics to build the def/use table.
  // TODO It would be nicer if the def/use pass could just ignore the externs
  // since we find them separately, below.
  let defuse = find_def_use(tree, intrinsics_map);

  // Find the "real" externs in the program, and add the intrinsics to the
  // map.
  let externs = find_externs(tree, []);
  for (let name in intrinsics_map) {
    let id = intrinsics_map[name];
    externs[id] = name;
  }

  // Lambda- and quote-lifting.
  let containers = find_scopes(tree);
  let [procs, main, progs] = lift(tree, defuse, containers, type_table);

  // Find variants for presplicing pass.
  let variants = presplice(progs);

  return {
    defuse: defuse,
    procs: procs,
    progs: progs,
    main: main,
    type_table: type_table,
    externs: externs,
    containers: containers,
    presplice_variants: variants,
  };
}
