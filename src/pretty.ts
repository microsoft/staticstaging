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
    return "!" + pretty(tree.expr);
  },

  visit_fun(tree: FunNode, _: void): string {
    let params = "";
    for (let param of tree.params) {
      params += param.name + " " + param.type + " ";
    }
    return "fun " + params + "-> " + pretty(tree.body);
  },

  visit_call(tree: CallNode, _: void): string {
    let s = pretty(tree.fun);
    for (let arg of tree.args) {
      s += " " + pretty(arg);
    }
    return s;
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
  } else if (v instanceof Fun) {
    return "(fun)";
  } else {
    throw "error: unknown value kind";
  }
}

// Format a type as a string.
function pretty_type(t: Type): string {
  let s : string;
  let bt = t.basic;
  if (bt instanceof IntType) {
    s = "Int";
  } else if (bt instanceof FunType) {
    s = "";
    for (let pt of bt.params) {
      s += pretty_type(pt) + " ";
    }
    s += "-> " + pretty_type(bt.ret);
  } else {
    throw "error: unknown type kind";
  }

  if (t.stage > 0) {
    s = _repeat("<", t.stage) + s + _repeat(">", t.stage);
  } else if (t.stage < 0) {
    s = _repeat("[", -t.stage) + s + _repeat("]", -t.stage);
  }
  return s;
}
