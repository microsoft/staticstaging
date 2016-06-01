var DINGUS_URL = 'http://adriansampson.net/atw';
function encode_hash(obj) {
    var parts = [];
    for (var key in obj) {
        var value = obj[key];
        if (value !== undefined && value !== null && value !== "") {
            parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
        }
    }
    return '#' + parts.join('&');
}
function find_mode(e) {
    if (!e) {
        return null;
    }
    else if (e.dataset['mode']) {
        return e.dataset['mode'];
    }
    else {
        return find_mode(e.parentElement);
    }
}
document.addEventListener("DOMContentLoaded", function () {
    var the_window;
    function register_example(example) {
        example.addEventListener('click', function () {
            var code = example.textContent.trim();
            var mode = find_mode(example) || "compile";
            var hash = encode_hash({ code: code, mode: mode });
            if (the_window && the_window.opener && !the_window.closed) {
                the_window.location.hash = hash;
                the_window.focus();
            }
            else {
                var url = DINGUS_URL + hash;
                the_window = window.open(url, '_dingus');
                console.log(the_window);
            }
        });
    }
    var examples = document.querySelectorAll('.example');
    for (var i = 0; i < examples.length; ++i) {
        register_example(examples[i]);
    }
});
