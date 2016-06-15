declare function sscDingus(el: any, config: any);

/**
 * Load the content from an HTML <template> element by its selector.
 */
function getTemplate(selector: string) {
  let tmpl = document.querySelector(selector) as HTMLTemplateElement;

  if ("content" in tmpl) {
    // Browser supports <template>.
    return tmpl.content;
  } else {
    // Backwards compatibility (for IE).
    // http://stackoverflow.com/a/33138997/39182
    let fragment = document.createDocumentFragment();
    let children = tmpl.childNodes;
    for (let i = 0; i < children.length; ++i) {
      fragment.appendChild(children[i].cloneNode(true));
    }
    return fragment;
  }
}

/**
 * Replace a node in the DOM.
 */
function replace(new_: Node, old: Element) {
  old.parentNode.replaceChild(new_, old);
}

/**
 * Instantiate a template.
 */
function instantiate(tmpl: DocumentFragment): Node {
  console.log(tmpl.nodeType);
  return document.importNode(tmpl, true);
}

/**
 * Find a separator line, ---, in a code listing and separate it into the code
 * *before* that line and the code *after* it. We use this to separate the
 * code we show to the user from a preamble.
 */
function split_code(s: string): [string, string] {
  let index = s.search(/---\n/);
  if (index === -1) {
    // No marker: put all the code in the second half.
    return ['', s.trim()];
  } else {
    let front = s.slice(0, index);
    front = front.slice(0, front.lastIndexOf("\n"));

    let back = s.slice(index);
    back = back.slice(back.indexOf("\n"));

    return [front.trim(), back.trim()];
  }
}

/**
 * Replace a code block in the HTML with a dingus that initially contains the
 * same code.
 */
function dingusify(orig: Element, tmpl: DocumentFragment) {
  // Set up the dingus.
  let dingusEl = instantiate(tmpl);
  let dingus = sscDingus(dingusEl, {
    history: false,
    lineNumbers: false,
    scrollbars: false,
  });

  // Fill in the code.
  let code = orig.textContent.trim();
  let [front, back] = split_code(code);
  dingus.set_preamble(front);
  dingus.run(back, "webgl");

  // Replace the old element with the new dingus.
  replace(dingusEl, orig);
  dingus.redraw();
}

document.addEventListener("DOMContentLoaded", function () {
  // Load the dingus template.
  let dingusTmpl = getTemplate('#template-dingus');

  // Transform each code block into a dingus.
  let pres = document.querySelectorAll('pre');
  for (let i = 0; i < pres.length; ++i) {
    let pre = pres[i];
    dingusify(pre, dingusTmpl);
  }
});
