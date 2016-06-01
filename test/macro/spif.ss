# Specialized `if`.
var spif = fun c:<Int> t:<Int> f:<Int> -> if !c t f;

# Just for fun, we'll define a macro-like function that just duplicates
# the built-in `if` expression.
var myif = fun c:<Int> t:<Int> f:<Int> -> < if [c] [t] [f] >;

# These functions can be invoked as normal, without the `@` prefix.
var spif? = fun s:<Int> c:<Int> t:<Int> f:<Int> ->
    if !s (spif c t f) (myif c t f);

< @spif 1 2 3 +
  @myif 1 2 3 +
  @spif? 0 1 2 3 +
  @spif? 1 1 2 3 >
# -> < 2 + (if 1 2 3) + (if 1 2 3) + 2 >
