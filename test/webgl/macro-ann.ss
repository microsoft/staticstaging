def macro(x:$glsl<Int>) x;
!<
vertex glsl<
  fragment glsl<
    var x = @macro 1;
  >
>
>
