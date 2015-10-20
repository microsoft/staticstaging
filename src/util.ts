// Create a copy of an object `obj`, optionally with its fields updated
// according to `values`.
// TODO Opportunistically avoid copying identical expressions? This would work
// best combined with full-on hash consing, which in turn would be painful
// without using ES6 Map.
function merge<T extends Object>(obj: T, values: Object = {}): T {
  let out = <T> {};
  for (let key in obj) {
    if (values.hasOwnProperty(key)) {
      (<any> out)[key] = (<any> values)[key];
    } else if (obj.hasOwnProperty(key)) {
      (<any> out)[key] = (<any> obj)[key];
    }
  }
  return out;
}

// An alternative that more closely matches ES6 Object.assign.
function assign <T, U> (target: T, ...sources: U[]): T & U {
  var t: any = {};
  for (var i = 0; i < arguments.length; ++i) {
    for (var k in arguments[i]) {
      t[k] = arguments[i][k];
    }
  }
  return t;
};

// A bit of a hack that abuses prototypes to create overlay. Return a copy of
// the argument where changing the new object won't affect the original.
function overlay<T>(base: T): T {
  return <T> Object.create(base);
}

// Lispy list manipulation.
function hd<T> (list: T[]): T {
  if (list.length === 0) {
    throw "error: head of empty list";
  }
  return list[0];
}

function tl<T> (list: T[]): T[] {
  if (list.length === 0) {
    throw "error: tail of empty list";
  }
  return list.slice(1);
}

function cons<T> (x: T, xs: T[]): T[] {
  return [x].concat(xs);
}

type Gen <T> = (_:T) => T;

// A fixed-point combinator.
function fix <T extends Function> (f : Gen<T>) : T {
  return <any> function (...args: any[]) {
    return (f(fix(f)))(...args);
  };
}

// Function composition.
function compose <A, B, C> (g : (_:B) => C, f : (_:A) => B): (_:A) => C {
  return function (x : A): C {
    return g(f(x));
  }
}

// Look up a key in a stack of maps, from left to right. Return the value and
// the position where it was found (or [undefined, undefined] if not found).
function stack_lookup <T> (
  mapstack: { [key: string]: T }[],
  ident: string):
  [T, number]
{
  let i = 0;
  for (let map of mapstack) {
    let value = map[ident];
    if (value !== undefined) {
      return [value, i];
    }
    ++i;
  }
  return [undefined, undefined];
}

// Treat an array as a set and insert into it. That is, do nothing if the
// value is already present, and otherwise push it onto the list.
function set_add <T> (a: T[], v: T): T[] {
  for (let x of a) {
    if (x === v) {
      return a;
    }
  }

  return cons(v, a);
}

// Eval inside a scope.
function scope_eval(code: string): any {
  return (function () {
    return eval(code);
  })();
}
