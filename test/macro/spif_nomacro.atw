var spif = fun c:<Int> t:<Int> f:<Int> -> if !c t f;
var myif = fun c:<Int> t:<Int> f:<Int> -> < if [c] [t] [f] >;
var spif? = fun s:<Int> c:<Int> t:<Int> f:<Int> ->
    if !s (spif c t f) (myif c t f);
< [ spif <1> <2> <3> ] +
  [ myif <1> <2> <3> ] +
  [ spif? <0> <1> <2> <3> ] +
  [ spif? <1> <1> <2> <3> ] >
# -> < 2 + (if 1 2 3) + (if 1 2 3) + 2 >
