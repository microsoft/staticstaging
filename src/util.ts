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
