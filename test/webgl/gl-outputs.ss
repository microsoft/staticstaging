var x = 5;
vertex glsl<
  var y = %[x];
  gl_Position = gl_Position;
  fragment glsl<
    gl_FragColor = gl_FragColor
  >
>
