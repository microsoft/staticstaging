abstract class Type {
  _brand_Type: void;
}

// Primitive types are singular instances.
class PrimitiveType extends Type {
  constructor(public name: string) { super() };

  // A workaround to compensate for TypeScript's structural subtyping:
  // https://github.com/Microsoft/TypeScript/issues/202
  _brand_PrimitiveType: void;
};

// Simple top and bottom types.
class AnyType extends Type {
  _brand_AnyType: void;
};
class VoidType extends Type {
  _brand_AnyType: void;
};
const ANY = new AnyType();
const VOID = new VoidType();

// Function types are more complicated. Really wishing for ADTs here.
class FunType extends Type {
  constructor(public params: Type[], public ret: Type) { super() };
  _brand_FunType: void;
};

// Same with code types.
class CodeType extends Type {
  constructor(public inner: Type) { super() };
  _brand_CodeType: void;
};

// Type constructors: the basic element of parametricity.
class ConstructorType extends Type {
  constructor(public name: string) { super() };
  instance(arg: Type) {
    return new InstanceType(this, arg);
  };
  _brand_ConstructorType: void;
}
class InstanceType extends Type {
  constructor(public cons: ConstructorType, public arg: Type) { super() };
  _brand_InstanceType: void;
}

// Slightly more general parametricity with a universal quantifier.
class QuantifiedType extends Type {
  constructor(public variable: VariableType, public inner: Type) { super() };
  _brand_QuantifiedType: void;
}
class VariableType extends Type {
  constructor(public name: string) { super() };
  _brand_VariableType: void;
}


// Type-related data structures and built-in types.

// Type maps are used all over the place: most urgently, as "frames" in the
// type checker's environment.
interface TypeMap {
  [name: string]: Type;
}

// The built-in primitive types.
const INT = new PrimitiveType("Int");
const FLOAT = new PrimitiveType("Float");
const BUILTIN_TYPES: TypeMap = {
  "Int": INT,
  "Float": FLOAT,
};


// Visiting type trees.

interface TypeVisit<P, R> {
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

function type_visit<P, R>(visitor: TypeVisit<P, R>,
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
