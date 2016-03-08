# title: macros
# mode: interp
# ---

# A specialized `if` that runs at this
# "compile-time" stage rather than at
# run time.
var spif = fun c:<Int> t:$<Int> f:$<Int> ->
  (if !c t f);

# Here's the program we're generating.
<
  var x = 35;
  var y = 7;
  @spif 1 x y +
  @spif 0 x y
>
