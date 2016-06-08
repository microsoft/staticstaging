/**
 * Load the content from an HTML <template> element by its selector.
 */
function getTemplate(selector) {
    var tmpl = document.querySelector(selector);
    if ("content" in tmpl) {
        // Browser supports <template>.
        return tmpl.content;
    }
    else {
        // Backwards compatibility (for IE).
        // http://stackoverflow.com/a/33138997/39182
        var fragment = document.createDocumentFragment();
        var children = tmpl.childNodes;
        for (var i = 0; i < children.length; ++i) {
            fragment.appendChild(children[i].cloneNode(true));
        }
        return fragment;
    }
}
/**
 * Replace a node in the DOM.
 */
function replace(new_, old) {
    old.parentNode.replaceChild(new_, old);
}
/**
 * Instantiate a template.
 */
function instantiate(tmpl) {
    console.log(tmpl.nodeType);
    return document.importNode(tmpl, true);
}
/**
 * Find a separator line, ---, in a code listing and separate it into the code
 * *before* that line and the code *after* it. We use this to separate the
 * code we show to the user from a preamble.
 */
function split_code(s) {
    var index = s.search(/---\n/);
    if (index === -1) {
        // No marker: put all the code in the second half.
        return ['', s.trim()];
    }
    else {
        var front = s.slice(0, index);
        front = front.slice(0, front.lastIndexOf("\n"));
        var back = s.slice(index);
        back = back.slice(back.indexOf("\n"));
        return [front.trim(), back.trim()];
    }
}
/**
 * Replace a code block in the HTML with a dingus that initially contains the
 * same code.
 */
function dingusify(orig, tmpl) {
    // Set up the dingus.
    var dingusEl = instantiate(tmpl);
    var dingus = sscDingus(dingusEl, {
        history: false,
        lineNumbers: false,
        scrollbars: false
    });
    // Fill in the code.
    var code = orig.textContent.trim();
    var _a = split_code(code), front = _a[0], back = _a[1];
    dingus.set_preamble(front);
    dingus.run(back, "webgl");
    // Replace the old element with the new dingus.
    replace(dingusEl, orig);
    dingus.redraw();
}
document.addEventListener("DOMContentLoaded", function () {
    // Load the dingus template.
    var dingusTmpl = getTemplate('#template-dingus');
    // Transform each code block into a dingus.
    var pres = document.querySelectorAll('pre');
    for (var i = 0; i < pres.length; ++i) {
        var pre = pres[i];
        dingusify(pre, dingusTmpl);
    }
});
