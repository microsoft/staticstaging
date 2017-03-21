// Eventually, it would be nice to import the .d.ts for the dingus, but it's
// not currently possible to emit those definitions.
declare function sscDingus(el: any, config: any): any;

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

/**
 * Log a message to the harness server.
 */
function log(obj: any) {
  let msg = JSON.stringify(obj);
  var req = new XMLHttpRequest();
  req.addEventListener('load', (evt) => {
    if (req.readyState === 4 && req.status === 200) {
      let res = JSON.parse(req.responseText);
      console.log(res);
      if (res === "done") {
        window.close();
      }
    }
  });
  req.open("GET", "/log?msg=" + encodeURIComponent(msg));
  req.send();
}

document.addEventListener("DOMContentLoaded", function () {
  // Set up the dingus.
  let base = document.querySelector('.sscdingus');
  let dingus = sscDingus(base, {
    history: false,
    fpsCallback: (frames: number, ms: number, latencies: number[],
                  draw_latencies: number[]) => {
      log({ frames, ms, latencies, draw_latencies });
    },
    perfMode: true,
  });

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
