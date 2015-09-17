// Create a copy of an object `obj`, optionally with its fields updated
// according to `values`.
// TODO Opportunistically avoid copying identical expressions?
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
