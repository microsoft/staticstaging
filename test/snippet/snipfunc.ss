# This function is slightly polymorphic: it works for any snippet code type.
# There is only one type variable, so the two parameters and the return type
# are all identical. This way, type inference is trivial.
var f = fun c:Int t:$<Int> f:$<Int> -> if c t f;

!<
  var x = 2;
  1 + $[ f 1 $<x * 3> $<x + 3> ];
>
# -> 7
