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

  visit_unary(tree: UnaryNode, _: void): string {
    return tree.op + pretty(tree.expr);
  },

  visit_binary(tree: BinaryNode, _: void): string {
    return pretty(tree.lhs) + " " + tree.op + " " + pretty(tree.rhs);
  },

  visit_quote(tree: QuoteNode, _: void): string {
    let out = "< " + pretty(tree.expr) + " >";
    if (tree.snippet) {
      out = "$" + out;
    }
    return out;
  },

  visit_escape(tree: EscapeNode, _: void): string {
    let out = "[ " + pretty(tree.expr) + " ]";
    if (tree.kind === "persist") {
      out = "%" + out;
    } else if (tree.kind === "snippet") {
      out = "$" + out;
    }
    if (tree.count > 1) {
      out += tree.count;
    }
    return out;
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
    let out = "extern " + tree.name + " : " + tree.type;
    if (tree.expansion) {
      out += ' "' + tree.expansion + '"';
    }
    return out;
  },

  visit_persist(tree: PersistNode, _: void): string {
    return "%" + tree.index;
  },
}

// Format an AST as a string.
function pretty(tree: SyntaxNode): string {
  return ast_visit(Pretty, tree, null);
}
