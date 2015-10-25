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
let pretty_type_rules: TypeVisit<void, string> = {
  visit_primitive(type: PrimitiveType, param: void): string {
    return type.name;
  },
  visit_fun(type: FunType, param: void): string {
    let s = "";
    for (let pt of type.params) {
      s += pretty_type(pt) + " ";
    }
    s += "-> " + pretty_type(type.ret);
    return s;
  },
  visit_code(type: CodeType, param: void): string {
    return "<" + pretty_type(type.inner) + ">";
  },
  visit_any(type: AnyType, param: void): string {
    return "any";
  },
  visit_void(type: VoidType, param: void): string {
    return "void";
  },
  visit_constructor(type: ConstructorType, param: void): string {
    return type.name;
  },
  visit_instance(type: InstanceType, param: void): string {
    return pretty_type(type.arg) + " " + type.cons.name;
  },
}

function pretty_type(type: Type) {
  return type_visit(pretty_type_rules, type, null);
}
