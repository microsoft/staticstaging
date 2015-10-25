/// <reference path="ast.ts" />
/// <reference path="visit.ts" />
/// <reference path="type.ts" />

let Pretty : ASTVisit<void, string> = {
  visit_literal(tree: LiteralNode, _: void): string {
    return tree.value.toString();
  },

  visit_seq(tree: SeqNode, _: void): string {
    return pretty(tree.lhs) + " ; " + pretty(tree.rhs);
  },

  visit_let(tree: LetNode, _: void): string {
    return "var " + tree.ident + " = " + pretty(tree.expr);
  },

  visit_assign(tree: AssignNode, _: void): string {
    return tree.ident + " = " + pretty(tree.expr);
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

  visit_extern(tree: ExternNode, _: void): string {
    return "extern " + tree.name + " : " + tree.type;
  },

  visit_persist(tree: PersistNode, _: void): string {
    return "%" + tree.index;
  },
}

// Format an AST as a string.
function pretty(tree: SyntaxNode): string {
  return ast_visit(Pretty, tree, null);
}

// Format a type as a string.
function pretty_type(t: Type): string {
  if (t instanceof PrimitiveType) {
    return t.name;
  } else if (t instanceof FunType) {
    let s = "";
    for (let pt of t.params) {
      s += pretty_type(pt) + " ";
    }
    s += "-> " + pretty_type(t.ret);
    return s;
  } else if (t instanceof CodeType) {
    return "<" + pretty_type(t.inner) + ">";
  } else if (t === ANY) {
    return "any";
  } else if (t === VOID) {
    return "void";
  } else if (t instanceof InstanceType) {
    return pretty_type(t.arg) + " " + t.cons.name;
  } else {
    throw "error: unknown type kind";
  }
}
