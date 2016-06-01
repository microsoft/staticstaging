var spif = fun c:<Int> t:<Int> f:<Int> -> if !c t f;

<
  var x = 2;
  var y = 3;
  @spif 1 x y
>
# -> type error
