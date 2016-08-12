def spif(c:Int, t:$<Int>, f:$<Int>)
  if c t f;

var z = 1;
!<
  var x = 5;
  var y = 9;
  @spif z x y
>
# -> 5
