const DINGUS_URL = 'http://adriansampson.net/atw';

function encode_hash(obj: { [key: string]: string }): string {
  let parts: string[] = [];
  for (let key in obj) {
    let value = obj[key];
    if (value !== undefined && value !== null && value !== "") {
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
    }
  }
  return '#' + parts.join('&');
}

document.addEventListener("DOMContentLoaded", function () {
  let the_window;
  function register_example(example: HTMLElement) {
    example.addEventListener('click', function () {
      let code = example.textContent.trim();
      let hash = encode_hash({code: code});

      if (the_window) {
        the_window.location.hash = hash;
        the_window.focus();
      } else {
        let url = DINGUS_URL + hash;
        the_window = window.open(url, '_dingus');
        console.log(the_window);
      }
    });
  }

  let examples = document.querySelectorAll('.example');
  for (let i = 0; i < examples.length; ++i) {
    register_example(examples[i] as HTMLElement);
  }
});
