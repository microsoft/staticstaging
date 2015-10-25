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

// A parameterized type is just a type-level function.
class ParameterizedType extends Type {
  constructor(public name: String) { super() };
  instance(arg: Type) {
    return new InstanceType(this, arg);
  };
}
class InstanceType extends Type {
  constructor(public cons: ParameterizedType, public arg: Type) { super() };
}

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
