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

function register_example(example: HTMLElement) {
  example.addEventListener('click', function () {
    let code = example.textContent.trim();
    let url = DINGUS_URL + encode_hash({code: code});
    window.open(url, '_dingus');
  });
}

document.addEventListener("DOMContentLoaded", function () {
  let examples = document.querySelectorAll('.example');
  for (let i = 0; i < examples.length; ++i) {
    register_example(examples[i] as HTMLElement);
  }
});
