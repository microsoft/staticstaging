# title: w/o metaprogramming
# mode: compile
# ---

# The examples so far have used strings and JavaScript's
# `eval` to implement SSC's quote and run. If you don't
# need splicing, there's another way: mark your quote with
# "js" and SSC will compile it as an ordinary JavaScript
# function---no `eval` necessary.
var x = 9;
var q = js< %[ x * 2 ] + 24 >;
!q
