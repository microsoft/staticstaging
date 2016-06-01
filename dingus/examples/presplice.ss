# title: pre-splicing
# mode: compile
# ---

var flag = 1;

# Try annotating this quote with an `f`; it still works.
!<
  var x = 4;
  var y = 5;

  # The $ stands for "$nippet" and avoids run-time splicing.
  $[ if flag $<2> $<3> ] +

  # It also lets you share the enclosing scope.
  $[ if flag $<x> $<y> ]
>
