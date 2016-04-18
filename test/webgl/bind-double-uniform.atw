# This tests the situation where the same constant is used as a uniform in
# both stages.
var x = 5;
render js<
  vertex glsl<
    x * 2;
    fragment glsl<
      x * 3
    >
  >
>
