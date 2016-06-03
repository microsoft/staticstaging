declare function sscDingus(el: any, config: any);

/**
 * Load the content from an HTML <template> element by its selector.
 */
function getTemplate(selector: string) {
  let tmpl = document.querySelector(selector) as HTMLTemplateElement;
  return tmpl.content;
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
  return document.importNode(tmpl, true);
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
  // dingus.set_preamble(preamble);
  dingus.run(code, "interp");

  // Replace the old element with the new dingus.
  replace(dingusEl, orig);

  // Redraw the CodeMirror box.
  dingus.cm.refresh();
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
