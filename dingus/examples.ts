const ATW_EXAMPLES = [
{
name: "basics",
mode: null,
code: `
# There are variables, functions, and
# arithmetic.
var x = 18;
var y = x + 3;
var double = fun n:Int -> n * 2;
double y
`,
},
{
name: "quote and splice",
mode: null,
code: `
# Use <> to defer code, ! to execute it,
# and [] to splice.
var x = <5>;
!< 37 + [x] >
`,
},
{
name: "persist",
mode: null,
code: `
# Cross-stage persistence works either via
# an explicit %[] escape or implicitly using
# variable references.
var x = 2;
var y = !< 37 + %[x] >;  # Explicit.
!< 37 + y >;  # Implicit.
`,
},
{
name: "extern",
mode: null,
code: `
# You can interoperate with JavaScript using
# extern declarations.
extern Math.pow: Int Int -> Int;
Math.pow 7 2;
`,
},
{
name: "basic shader",
mode: "webgl",
code: `
var projection = dingus.projection;
var model = dingus.model;
var view = dingus.view;
var position = bunny.positions;
var normal = bunny.normals;
render r<
  vtx s<
    gl_Position = projection * view * model * vec4(position, 1.0);
    frag s<
      gl_FragColor = vec4(abs(normal), 1.0);
    >
  >
>
`,
}
];
