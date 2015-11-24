/// <reference path="ir.ts" />
/// <reference path="defuse.ts" />
/// <reference path="lift.ts" />
/// <reference path="scope.ts" />

// Find all the `extern`s in a program.
type FindExterns = ASTFold<string[]>;
function gen_find_externs(fself: FindExterns): FindExterns {
  let fold_rules = ast_fold_rules(fself);
  let rules = compose_visit(fold_rules, {
    visit_extern(tree: ExternNode, externs: string[]): string[] {
      let e = externs.slice(0);
      e[tree.id] = tree.expansion || tree.name;
      return e;
    }
  });
  return function (tree: SyntaxNode, externs: string[]): string[] {
    return ast_visit(rules, tree, externs);
  };
}
let find_externs = fix(gen_find_externs);

// This is the semantic analysis that produces our mid-level IR given an
// elaborated, desugared AST.
function semantically_analyze(tree: SyntaxNode,
  type_table: Types.Elaborate.TypeTable,
  intrinsics: Types.TypeMap = {}): CompilerIR
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
  let defuse = DefUse.find_def_use(tree, intrinsics_map);

  // Find the "real" externs in the program, and add the intrinsics to the
  // map.
  let externs = find_externs(tree, []);
  for (let name in intrinsics_map) {
    let id = intrinsics_map[name];
    externs[id] = name;
  }

  // Lambda- and quote-lifting.
  let containers = FindScopes.find_scopes(tree);
  let [procs, main, progs] = Lift.lift(tree, defuse, containers, type_table);

  return {
    defuse: defuse,
    procs: procs,
    progs: progs,
    main: main,
    type_table: type_table,
    externs: externs,
    containers: containers,
  };
}
