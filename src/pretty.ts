import * as ast from './ast';
import { ASTVisit, ast_visit } from './visit';
import { set_in } from './util';

const TERM_TAGS = ["quote", "literal", "lookup", "escape", "run", "paren", "persist"];

/**
 * Check whether an AST node is a "non-term" expression, meaning it needs
 * parentheses in many contexts.
 */
function nonterm(tree: ast.SyntaxNode) {
  return !set_in(TERM_TAGS, tree.tag);
}

let Pretty : ASTVisit<void, string> = {
  visit_literal(tree: ast.LiteralNode, _: void): string {
    return tree.value.toString();
  },

  visit_seq(tree: ast.SeqNode, _: void): string {
    return pretty_paren(tree.lhs, t => t.tag === "seq") +
      " ; " + pretty(tree.rhs);
  },

  visit_let(tree: ast.LetNode, _: void): string {
    return "var " + tree.ident + " = " + pretty(tree.expr);
  },

  visit_assign(tree: ast.AssignNode, _: void): string {
    return tree.ident + " = " + pretty_paren(tree.expr, nonterm);
  },

  visit_lookup(tree: ast.LookupNode, _: void): string {
    return tree.ident;
  },

  visit_unary(tree: ast.UnaryNode, _: void): string {
    return tree.op + pretty_paren(tree.expr, nonterm);
  },

  visit_binary(tree: ast.BinaryNode, _: void): string {
    function pred(t: ast.SyntaxNode) {
      // Don't parenthesize other binary expressions of the same kind.
      if (t.tag === "binary" && (t as ast.BinaryNode).op === tree.op) {
        return false;
      }
      return nonterm(t);
    }
    return pretty_paren(tree.lhs, pred) +
      " " + tree.op +
      " " + pretty_paren(tree.rhs, pred);
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
    return "!" + pretty_paren(tree.expr, nonterm);
  },

  visit_fun(tree: ast.FunNode, _: void): string {
    let params = "";
    for (let param of tree.params) {
      params += param.name + " " + param.type + " ";
    }
    return "fun " + params + "-> " + pretty_paren(tree.body, nonterm);
  },

  visit_call(tree: ast.CallNode, _: void): string {
    let s = pretty_paren(tree.fun, nonterm);
    for (let arg of tree.args) {
      s += " " + pretty_paren(arg, nonterm);
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
    return "if " + pretty_paren(tree.cond, nonterm) +
      " " + pretty_paren(tree.truex, nonterm) +
      " " + pretty_paren(tree.falsex, nonterm);
  },

  visit_macro(tree: ast.MacroNode, _: void): string {
    return `macro ${tree.ident} = ${pretty(tree.expr)}`;
  },
}

/**
 * Format an AST as a string.
 */
export function pretty(tree: ast.SyntaxNode): string {
  return ast_visit(Pretty, tree, null);
}

/**
 * Pretty-print an AST , and parenthesize it conditionally.
 */
function pretty_paren(tree: ast.SyntaxNode, pred: (t: ast.SyntaxNode) => boolean): string {
  let out = pretty(tree);
  if (pred(tree)) {
    return "(" + out + ")";
  } else {
    return out;
  }
}
