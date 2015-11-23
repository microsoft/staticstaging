/// <reference path="type.ts" />
/// <reference path="ast.ts" />
/// <reference path="visit.ts" />
/// <reference path="pretty.ts" />

module Types.Check {

// A type environment contains all the state that threads through the type
// checker.
export interface TypeEnv {
  // A map stack with the current stage at the front of the list. Prior stages
  // are to the right. Normal accesses must refer to the top environment
  // frame; subsequent ones are "auto-persists".
  stack: TypeMap[],

  // A stack of *quote annotations*, which allows type system extensions to be
  // sensitive to the quote context.
  anns: string[],

  // A single frame for "extern" values, which are always available without
  // any persisting.
  externs: TypeMap,

  // A map for *named types*. Unlike the other maps, each entry here
  // represents a *type*, not a variable.
  named: TypeMap,

  // The current *snippet escape* (or null if there is none). The tuple
  // consists of the ID of the escape and two pieces of the environment at
  // that point that should be "resumed" on quote: the `stack` and `anns`
  // stacks.
  snip: [number, TypeMap[], string[]],
};


// The built-in operator types. These can be extended by providing custom
// intrinsics.
const _UNARY_TYPE = new OverloadedType([
  new FunType([INT], INT),
  new FunType([FLOAT], FLOAT),
]);
const _BINARY_TYPE = new OverloadedType([
  new FunType([INT, INT], INT),
  new FunType([FLOAT, FLOAT], FLOAT),
]);
const _UNARY_BINARY_TYPE = new OverloadedType(
  _UNARY_TYPE.types.concat(_BINARY_TYPE.types)
);
export const BUILTIN_OPERATORS: TypeMap = {
  '+': _UNARY_BINARY_TYPE,
  '-': _UNARY_BINARY_TYPE,
  '*': _BINARY_TYPE,
  '/': _BINARY_TYPE,
};


// The type checker.
// The checker is written as a "function generator," and we'll later take its
// fixed point to get an ordinary type checker function (of type `TypeCheck`,
// below).

export type TypeCheck = (tree: SyntaxNode, env: TypeEnv) => [Type, TypeEnv];
export let gen_check : Gen<TypeCheck> = function(check) {
  let type_rules : ASTVisit<TypeEnv, [Type, TypeEnv]> = {
    visit_literal(tree: LiteralNode, env: TypeEnv): [Type, TypeEnv] {
      if (tree.type === "int") {
        return [INT, env];
      } else if (tree.type === "float") {
        return [FLOAT, env];
      } else {
        throw "error: unknown literal type";
      }
    },

    visit_seq(tree: SeqNode, env: TypeEnv): [Type, TypeEnv] {
      let [t, e] = check(tree.lhs, env);
      return check(tree.rhs, e);
    },

    visit_let(tree: LetNode, env: TypeEnv): [Type, TypeEnv] {
      // Check the assignment expression.
      let [t, e] = check(tree.expr, env);

      // Insert the new type into the front of the map stack.
      let head = overlay(hd(e.stack)); // Update type in an overlay environment.
      head[tree.ident] = t;
      let e2: TypeEnv = merge(e, { stack: cons(head, tl(e.stack)) });

      return [t, e2];
    },

    visit_assign(tree: AssignNode, env: TypeEnv): [Type, TypeEnv] {
      // Check the value expression.
      let [expr_t, e] = check(tree.expr, env);

      // Check that the new value is compatible with the variable's type.
      // Try a normal variable first.
      let [var_t,] = stack_lookup(env.stack, tree.ident);
      if (var_t === undefined) {
        var_t = env.externs[tree.ident];
        if (var_t === undefined) {
          throw "type error: assignment to undeclared variable " + tree.ident;
        }
      }

      if (!compatible(var_t, expr_t)) {
        throw "type error: mismatched type in assigment: " +
          "expected " + pretty_type(var_t) +
          ", got " + pretty_type(expr_t);
      }

      return [var_t, e];
    },

    visit_lookup(tree: LookupNode, env: TypeEnv): [Type, TypeEnv] {
      // Try a normal variable first.
      let [t,] = stack_lookup(env.stack, tree.ident);
      if (t !== undefined) {
        return [t, env];
      }

      // Next, try looking for an extern.
      let et = env.externs[tree.ident];
      if (et !== undefined) {
        return [et, env];
      }

      throw "type error: undefined variable " + tree.ident;
    },

    visit_unary(tree: UnaryNode, env: TypeEnv): [Type, TypeEnv] {
      let [t, e] = check(tree.expr, env);

      // Unary and binary operators use intrinsic functions whose names match
      // the operator. Currently, these can *only* be defined as externs; for
      // more flexible operator overloading, we could eventually also look at
      // ordinary variable.
      let fun = env.externs[tree.op];
      let ret = check_call(fun, [t]);
      if (ret instanceof Type) {
        return [ret, e];
      } else {
        throw "type error: invalid unary operation (" +
            tree.op + " " + pretty_type(t) + ")";
      }
    },

    visit_binary(tree: BinaryNode, env: TypeEnv): [Type, TypeEnv] {
      let [t1, e1] = check(tree.lhs, env);
      let [t2, e2] = check(tree.rhs, e1);

      // Use extern functions, as with unary operators.
      let fun = env.externs[tree.op];
      let ret = check_call(fun, [t1, t2]);
      if (ret instanceof Type) {
        return [ret, e2];
      } else {
        throw "type error: invalid binary operation (" +
            pretty_type(t1) + " " + tree.op + " " + pretty_type(t2) + ")";
      }
    },

    visit_quote(tree: QuoteNode, env: TypeEnv): [Type, TypeEnv] {
      // If this is a snippet quote, we need to "resume" type context from the
      // escape point. Also, we'll record the ID from the environment in the
      // type.
      let snippet: number = null;
      let inner_env: TypeEnv;
      if (tree.snippet) {
        if (env.snip === null) {
          throw "type error: snippet quote without matching snippet escape";
        }
        let [snip_id, snip_stack, snip_anns] = env.snip;
        snippet = snip_id;

        // "Resume" context for the quote.
        inner_env = merge(env, {
          stack: snip_stack,
          anns: snip_anns,
          snip: null,
        });

      } else {
        // Ordinary, independent quote. Push an empty stack frame.
        inner_env = merge(env, {
          stack: cons(<TypeMap> {}, env.stack),
          anns: cons(tree.annotation, env.anns),
          snip: null,
        });
      }

      // Check inside the quote using the empty frame.
      let [t, e] = check(tree.expr, inner_env);

      // Move the result type "down" to a code type.
      let code_type = new CodeType(t, tree.annotation, snippet);

      // Ignore any changes to the environment.
      let out_env = env;
      if (tree.snippet) {
        // Store away the updated context for any subsequent snippets.
        out_env = merge(out_env, {
            snip: [snippet, e.stack, e.anns],
        });
      }

      return [code_type, out_env];
    },

    visit_escape(tree: EscapeNode, env: TypeEnv): [Type, TypeEnv] {
      // Make sure we don't escape "too far" beyond the top level.
      let level = env.stack.length;
      let count = tree.count;
      if (count > level) {
        throw `type error: can't escape ${count}x at level ${level}`;
      }

      // Pop `count` quotation contexts off the stack.
      let stack_inner = env.stack.slice(count);
      let anns_inner = env.anns.slice(count);

      // If this is a snippet escape, record it. Otherwise, the nearest
      // snippet is null.
      let snip_id: number = null;
      if (tree.kind === "snipppet") {
        snip_id = tree.id;
      }

      // Check the contents of the escape.
      let inner_env: TypeEnv = merge(env, {
        stack: stack_inner,
        anns: anns_inner,
        snip: [snip_id, env.stack, env.anns],
      });
      let [t, e] = check(tree.expr, inner_env);

      if (tree.kind === "splice") {
        // The result of the escape's expression must be code, so it can be
        // spliced.
        if (t instanceof CodeType) {
          // The result type is the type that was quoted.
          return [t.inner, env];
        } else {
          throw "type error: splice escape produced non-code value";
        }

      } else if (tree.kind === "persist") {
        // A persist escape has the same type as the original type.
        return [t, env];

      } else if (tree.kind === "snippet") {
        if (t instanceof CodeType) {
          if (t.snippet === null) {
            throw "type error: non-snippet code in snippet splice";
          } else if (t.snippet !== tree.id) {
            throw "type error: mismatched snippet splice";
          }
          return [t.inner, env];
        } else {
          throw "type error: snippet escape produced non-code value";
        }

      } else {
        throw "error: unknown escape kind";
      }
    },

    visit_run(tree: RunNode, env: TypeEnv): [Type, TypeEnv] {
      let [t, e] = check(tree.expr, env);
      if (t instanceof CodeType) {
        return [t.inner, e];
      } else {
        throw "type error: running a non-code type " + pretty_type(t);
      }
    },

    visit_fun(tree: FunNode, env: TypeEnv): [Type, TypeEnv] {
      // Get the list of declared parameter types and accumulate them in an
      // environment based on the top of the environment stack.
      let param_types : Type[] = [];
      let body_env_hd = overlay(hd(env.stack));
      for (let param of tree.params) {
        let [ptype,] = check(param, env);
        param_types.push(ptype);
        body_env_hd[param.name] = ptype;
      }

      // Check the body and get the return type.
      let body_env: TypeEnv = merge(env, {
        stack: cons(body_env_hd, tl(env.stack)),
      });
      let [ret_type,] = check(tree.body, body_env);

      // Construct the function type.
      let fun_type = new FunType(param_types, ret_type);
      return [fun_type, env];
    },

    visit_param(tree: ParamNode, env: TypeEnv): [Type, TypeEnv] {
      return [get_type(tree.type, env.named), env];
    },

    visit_call(tree: CallNode, env: TypeEnv): [Type, TypeEnv] {
      // Check the type of the thing we're calling.
      let [target_type, e] = check(tree.fun, env);

      // Check each argument type.
      let arg_types: Type[] = [];
      let arg_type: Type;
      for (let arg of tree.args) {
        [arg_type, e] = check(arg, e);
        arg_types.push(arg_type);
      }

      // Check the call itself.
      let ret = check_call(target_type, arg_types);
      if (ret instanceof Type) {
        return [ret, e];
      } else {
        throw ret;
      }
    },

    visit_extern(tree: ExternNode, env: TypeEnv): [Type, TypeEnv] {
      // Add the type to the extern map.
      let new_externs = overlay(env.externs);
      let type = get_type(tree.type, env.named);
      new_externs[tree.name] = type;
      let e: TypeEnv = merge(env, {
          externs: new_externs,
      });

      return [type, e];
    },

    visit_persist(tree: PersistNode, env: TypeEnv): [Type, TypeEnv] {
      throw "error: persist cannot be type-checked in source code";
    },
  };

  // The entry point for the recursion.
  return function (tree, env) {
    return ast_visit(type_rules, tree, env);
  }
}

// Check that a function call is well-typed. Return the result type or a
// string indicating the error.
function check_call(target: Type, args: Type[]): Type | string {
  // The target is an ordinary function.
  if (target instanceof FunType) {
    // Check that the arguments are the right type.
    if (args.length != target.params.length) {
      return "type error: mismatched argument length";
    }
    for (let i = 0; i < args.length; ++i) {
      let param = target.params[i];
      let arg = args[i];
      if (!compatible(param, arg)) {
        return "type error: mismatched argument type at index " + i +
          ": expected " + pretty_type(param) +
          ", got " + pretty_type(arg);
      }
    }

    return target.ret;

  // An overloaded type. Try each component type.
  } else if (target instanceof OverloadedType) {
    for (let sub of target.types) {
      let ret = check_call(sub, args);
      if (ret instanceof Type) {
        return ret;
      }
    }
    return "type error: no overloaded type applies";

  } else {
    return "type error: call of non-function";
  }
}

// Check type compatibility.
function compatible(ltype: Type, rtype: Type): boolean {
  if (ltype === rtype) {
    return true;

  } else if (ltype === FLOAT && rtype === INT) {
    return true;

  } else if (ltype === ANY) {
    return true;

  } else if (ltype instanceof FunType && rtype instanceof FunType) {
    if (ltype.params.length != rtype.params.length) {
      return false;
    }
    for (let i = 0; i < ltype.params.length; ++i) {
      let lparam = ltype.params[i];
      let rparam = rtype.params[i];
      if (!compatible(rparam, lparam)) {  // Contravariant.
        return false;
      }
    }
    return compatible(ltype.ret, rtype.ret);  // Covariant.

  } else if (ltype instanceof InstanceType && rtype instanceof InstanceType) {
    if (ltype.cons === rtype.cons) {
      // Invariant.
      return compatible(ltype.arg, rtype.arg) &&
        compatible(rtype.arg, ltype.arg);
    }

  } else if (ltype instanceof CodeType && rtype instanceof CodeType) {
    return compatible(ltype.inner, rtype.inner) &&
      ltype.annotation === rtype.annotation &&
      ltype.snippet === rtype.snippet;

  }

  return false;
}

// Get the Type denoted by the type syntax tree.
let get_type_rules: TypeASTVisit<TypeMap, Type> = {
  visit_primitive(tree: PrimitiveTypeNode, types: TypeMap) {
    let t = types[tree.name];
    if (t !== undefined) {
      if (t instanceof ConstructorType) {
        throw "type error: " + tree.name + " needs a parameter";
      } else {
        return t;
      }
    } else {
      throw "type error: unknown primitive type " + tree.name;
    }
  },

  visit_fun(tree: FunTypeNode, types: TypeMap) {
    let params: Type[] = [];
    for (let param_node of tree.params) {
      params.push(get_type(param_node, types));
    }
    let ret = get_type(tree.ret, types);

    return new FunType(params, ret);
  },

  visit_code(tree: CodeTypeNode, types: TypeMap) {
    let inner = get_type(tree.inner, types);
    return new CodeType(inner, tree.annotation);
  },

  visit_instance(tree: InstanceTypeNode, types: TypeMap) {
    let t = types[tree.name];
    if (t !== undefined) {
      if (t instanceof ConstructorType) {
        let arg = get_type(tree.arg, types);
        return t.instance(arg);
      } else {
        throw "type error: " + tree.name + " is not parameterized";
      }
    } else {
      throw "type error: unknown type constructor " + tree.name;
    }
  },
};

function get_type(ttree: TypeNode, types: TypeMap): Type {
  return type_ast_visit(get_type_rules, ttree, types);
}

// Fill in a parameterized type.
let apply_type_rules: TypeVisit<[VariableType, Type], Type> = {
  // This is the only interesting rule: replace the requested variable with
  // the argument.
  visit_variable(type: VariableType, [tvar, targ]: [VariableType, Type]): Type {
    if (type === tvar) {
      return targ;
    } else {
      return type;
    }
  },

  // The remaining rules are just boring boilerplate: `map` for types.
  visit_primitive(type: PrimitiveType,
      [tvar, targ]: [VariableType, Type]): Type
  {
    return type;
  },
  visit_fun(type: FunType, [tvar, targ]: [VariableType, Type]): Type {
    let params: Type[] = [];
    for (let param of type.params) {
      params.push(apply_type(param, tvar, targ));
    }
    let ret = apply_type(type.ret, tvar, targ);
    return new FunType(params, ret);
  },
  visit_code(type: CodeType, [tvar, targ]: [VariableType, Type]): Type {
    return new CodeType(apply_type(type.inner, tvar, targ), type.annotation);
  },
  visit_any(type: AnyType, [tvar, targ]: [VariableType, Type]): Type {
    return type;
  },
  visit_void(type: VoidType, [tvar, targ]: [VariableType, Type]): Type {
    return type;
  },
  visit_constructor(type: ConstructorType,
      [tvar, targ]: [VariableType, Type]): Type
  {
    return type;
  },
  visit_instance(type: InstanceType,
      [tvar, targ]: [VariableType, Type]): Type
  {
    return new InstanceType(type.cons, apply_type(type.arg, tvar, targ));
  },
  visit_quantified(type: QuantifiedType,
      [tvar, targ]: [VariableType, Type]): Type
  {
    return new QuantifiedType(type.variable,
        apply_type(type.inner, tvar, targ));
  },
}

function apply_type(type: Type, tvar: VariableType, targ: Type): Type {
  return type_visit(apply_type_rules, type, [tvar, targ]);
}

function apply_quantified_type(type: QuantifiedType, arg: Type): Type {
  return apply_type(type.inner, type.variable, arg);
}

}
