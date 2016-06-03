declare function sscDingus(el: any, config: any);

document.addEventListener("DOMContentLoaded", function () {
  var base = document.querySelector('.sscdingus');
  sscDingus(base, {
    history: false,
    lineNumbers: false,
    scrollbars: false,
  });
});
