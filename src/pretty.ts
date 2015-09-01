/// <reference path="ast.ts" />
/// <reference path="visit.ts" />
/// <reference path="interp.ts" />
/// <reference path="type.ts" />

let Pretty : ASTVisit<void, string> = {
  visit_literal(tree: LiteralNode, _: void): string {
    return tree.value.toString();
  },

  visit_seq(tree: SeqNode, _: void): string {
    return pretty(tree.lhs) + " ; " + pretty(tree.rhs);
  },

  visit_let(tree: LetNode, _: void): string {
    return "let " + tree.ident + " = " + pretty(tree.expr);
  },

  visit_lookup(tree: LookupNode, _: void): string {
    return tree.ident;
  },

  visit_binary(tree: BinaryNode, _: void): string {
    return pretty(tree.lhs) + " " + tree.op + " " + pretty(tree.rhs);
  },

  visit_quote(tree: QuoteNode, _: void): string {
    return "< " + pretty(tree.expr) + " >";
  },

  visit_escape(tree: EscapeNode, _: void): string {
    return "[ " + pretty(tree.expr) + " ]";
  },

  visit_run(tree: RunNode, _: void): string {
    return "!" + pretty(tree);
  },
}

// Format an AST as a string.
function pretty(tree: SyntaxNode): string {
  return ast_visit(Pretty, tree, null);
}

// Format a resulting value as a string.
function pretty_value(v: Value): string {
  if (typeof v == 'number') {
    return v.toString();
  } else if (v instanceof Code) {
    return "< " + pretty(v.expr) + " >";
  }
}

// Format a type as a string.
function pretty_type(t: Type): string {
  let s = TypeTag[t.tag];
  if (t.stage > 0) {
    s = _repeat("<", t.stage) + s + _repeat(">", t.stage);
  } else if (t.stage < 0) {
    s = _repeat("[", -t.stage) + s + _repeat("]", -t.stage);
  }
  return s;
}
