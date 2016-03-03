export abstract class Type {
  _brand_Type: void;
}

// Primitive types are singular instances.
export class PrimitiveType extends Type {
  constructor(public name: string) { super() };

  // A workaround to compensate for TypeScript's structural subtyping:
  // https://github.com/Microsoft/TypeScript/issues/202
  _brand_PrimitiveType: void;
};

// Simple top and bottom types.
export class AnyType extends Type {
  _brand_AnyType: void;
};
export class VoidType extends Type {
  _brand_AnyType: void;
};
export const ANY = new AnyType();
export const VOID = new VoidType();

// Function types are more complicated. Really wishing for ADTs here.
export class FunType extends Type {
  constructor(public params: Type[], public ret: Type) { super() };
  _brand_FunType: void;
};

// Same with code types.
export class CodeType extends Type {
  constructor(
    public inner: Type,
    public annotation: string,
    public snippet: number = null  // Corresponding escape ID.
  ) { super() };
  _brand_CodeType: void;
};

// Type constructors: the basic element of parametricity.
export class ConstructorType extends Type {
  constructor(public name: string) { super() };
  instance(arg: Type) {
    return new InstanceType(this, arg);
  };
  _brand_ConstructorType: void;
}
export class InstanceType extends Type {
  constructor(public cons: ConstructorType, public arg: Type) { super() };
  _brand_InstanceType: void;
}

// Slightly more general parametricity with a universal quantifier.
export class QuantifiedType extends Type {
  constructor(public variable: VariableType, public inner: Type) { super() };
  _brand_QuantifiedType: void;
}
export class VariableType extends Type {
  constructor(public name: string) { super() };
  _brand_VariableType: void;
}

// Simple overloading.
export class OverloadedType extends Type {
  constructor(public types: Type[]) { super() };
  _brand_OverloadedType: void;
}


// Type-related data structures and built-in types.

// Type maps are used all over the place: most urgently, as "frames" in the
// type checker's environment.
export interface TypeMap {
  [name: string]: Type;
}

// The built-in primitive types.
export const INT = new PrimitiveType("Int");
export const FLOAT = new PrimitiveType("Float");
export const BUILTIN_TYPES: TypeMap = {
  "Int": INT,
  "Float": FLOAT,
  "Void": VOID,
};


// Visiting type trees.

export interface TypeVisit<P, R> {
  visit_primitive(type: PrimitiveType, param: P): R;
  visit_fun(type: FunType, param: P): R;
  visit_code(type: CodeType, param: P): R;
  visit_any(type: AnyType, param: P): R;
  visit_void(type: VoidType, param: P): R;
  visit_constructor(type: ConstructorType, param: P): R;
  visit_instance(type: InstanceType, param: P): R;
  visit_quantified(type: QuantifiedType, param: P): R;
  visit_variable(type: VariableType, param: P): R;
}

export function type_visit<P, R>(visitor: TypeVisit<P, R>,
                          type: Type, param: P): R {
  if (type instanceof PrimitiveType) {
    return visitor.visit_primitive(type, param);
  } else if (type instanceof FunType) {
    return visitor.visit_fun(type, param);
  } else if (type instanceof CodeType) {
    return visitor.visit_code(type, param);
  } else if (type instanceof AnyType) {
    return visitor.visit_any(type, param);
  } else if (type instanceof VoidType) {
    return visitor.visit_void(type, param);
  } else if (type instanceof ConstructorType) {
    return visitor.visit_constructor(type, param);
  } else if (type instanceof InstanceType) {
    return visitor.visit_instance(type, param);
  } else if (type instanceof QuantifiedType) {
    return visitor.visit_quantified(type, param);
  } else if (type instanceof VariableType) {
    return visitor.visit_variable(type, param);
  } else {
    throw "error: unknown type kind " + typeof(type);
  }
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
    let out = "<" + pretty_type(type.inner) + ">";
    if (type.annotation) {
      out = type.annotation + out;
    }
    if (type.snippet) {
      out = "$" + type.snippet + out;
    }
    return out;
  },
  visit_any(type: AnyType, param: void): string {
    return "Any";
  },
  visit_void(type: VoidType, param: void): string {
    return "Void";
  },
  visit_constructor(type: ConstructorType, param: void): string {
    return type.name;
  },
  visit_instance(type: InstanceType, param: void): string {
    return pretty_type(type.arg) + " " + type.cons.name;
  },
  visit_quantified(type: QuantifiedType, param: void): string {
    return pretty_type(type.inner);
  },
  visit_variable(type: VariableType, param: void): string {
    return type.name;
  },
}

export function pretty_type(type: Type) {
  return type_visit(pretty_type_rules, type, null);
}
