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

function _repeat(s: string, n: number): string {
  let o = "";
  for (let i = 0; i < n; ++i) {
    o += s;
  }
  return o;
}

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

// The Y combinator. Adapted from Matt Might's JavaScript Y:
// http://matt.might.net/articles/implementation-of-recursive-fixed-point-y-
// combinator-in-javascript-for-memoization/
// I added support for multiple-argument functions. I don't think it's
// possible to typecheck this TypeScript, so it's quite unsafe.
function fix <T extends Function> (f : Gen<T>) : T {
  return (function (x : any) {
    return f(<any> function (...y: any[]) { return (x(x))(...y); });
  })
  (function (x : any) {
    return f(<any> function (...y: any[]) { return (x(x))(...y); });
  });
};

// Function composition.
function compose <A, B, C> (g : (_:B) => C, f : (_:A) => B): (_:A) => C {
  return function (x : A): C {
    return g(f(x));
  }
}
