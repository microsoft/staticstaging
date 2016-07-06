/**
 * Decode the window's hash component as if it were a query string. Return a
 * key--value map.
 */
function decode_hash(s: string): { [key: string]: string } {
  if (s[0] === "#") {
    s = s.slice(1);
  }

  let out: { [key: string]: string } = {};
  for (let part of s.split('&')) {
    let [key, value] = part.split('=');
    out[decodeURIComponent(key)] = decodeURIComponent(value);
  }
  return out;
}

declare function sscDingus(el: any, config: any): any;

document.addEventListener("DOMContentLoaded", function () {
  // Set up the dingus.
  let base = document.querySelector('.sscdingus');
  let dingus = sscDingus(base, { history: false });

  // Load code into the dingus.
  function handle_hash() {
    let values = decode_hash(location.hash);
    let code = values['code'];
    if (code) {
      dingus.run(code, 'webgl');
    }
  }

  // Set up hash handler.
  window.addEventListener('hashchange', function () {
    handle_hash();
  });
  handle_hash();
});
