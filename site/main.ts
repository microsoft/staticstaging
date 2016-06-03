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

function dingusify(orig: Element, tmpl: DocumentFragment) {
  let code = orig.textContent;
  console.log(code);

  let dingus = instantiate(tmpl);
  replace(dingus, orig);
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

  let base = document.querySelector('.sscdingus');
  sscDingus(base, {
    history: false,
    lineNumbers: false,
    scrollbars: false,
  });
});
