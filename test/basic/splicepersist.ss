var x = 4;
var a = < 2 + %[ x ] >;
var b = < %[ x ] + [ a ] >;
var c = < %[ !b ] + [ b ] >;
!c
# -> 20
