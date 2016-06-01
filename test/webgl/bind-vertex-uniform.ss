# A uniform that is *only* used at the vertex stage.
var x = 5;
render js<
  vertex glsl<
    x * 3;
    fragment glsl<
      3
    >
  >
>
