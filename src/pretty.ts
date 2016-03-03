import * as ast from './ast';
import { ASTVisit, ast_visit } from './visit';

let Pretty : ASTVisit<void, string> = {
  visit_literal(tree: ast.LiteralNode, _: void): string {
    return tree.value.toString();
  },

  visit_seq(tree: ast.SeqNode, _: void): string {
    return pretty(tree.lhs) + " ; " + pretty(tree.rhs);
  },

  visit_let(tree: ast.LetNode, _: void): string {
    return "var " + tree.ident + " = " + pretty(tree.expr);
  },

  visit_assign(tree: ast.AssignNode, _: void): string {
    return tree.ident + " = " + pretty(tree.expr);
  },

  visit_lookup(tree: ast.LookupNode, _: void): string {
    return tree.ident;
  },

  visit_unary(tree: ast.UnaryNode, _: void): string {
    return tree.op + pretty(tree.expr);
  },

  visit_binary(tree: ast.BinaryNode, _: void): string {
    return pretty(tree.lhs) + " " + tree.op + " " + pretty(tree.rhs);
  },

  visit_quote(tree: ast.QuoteNode, _: void): string {
    let out = "< " + pretty(tree.expr) + " >";
    if (tree.snippet) {
      out = "$" + out;
    }
    return out;
  },

  visit_escape(tree: ast.EscapeNode, _: void): string {
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

  visit_run(tree: ast.RunNode, _: void): string {
    return "!" + pretty(tree.expr);
  },

  visit_fun(tree: ast.FunNode, _: void): string {
    let params = "";
    for (let param of tree.params) {
      params += param.name + " " + param.type + " ";
    }
    return "fun " + params + "-> " + pretty(tree.body);
  },

  visit_call(tree: ast.CallNode, _: void): string {
    let s = pretty(tree.fun);
    for (let arg of tree.args) {
      s += " " + pretty(arg);
    }
    return s;
  },

  visit_extern(tree: ast.ExternNode, _: void): string {
    let out = "extern " + tree.name + " : " + tree.type;
    if (tree.expansion) {
      out += ' "' + tree.expansion + '"';
    }
    return out;
  },

  visit_persist(tree: ast.PersistNode, _: void): string {
    return "%" + tree.index;
  },

  visit_if(tree: ast.IfNode, _: void): string {
    return "if " + pretty(tree.cond) + " " + pretty(tree.truex) + " " +
      pretty(tree.falsex);
  }
}

// Format an AST as a string.
export function pretty(tree: ast.SyntaxNode): string {
  return ast_visit(Pretty, tree, null);
}
