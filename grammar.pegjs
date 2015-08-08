Program
  = _ e:Expr _
  { return e; }


// Syntax.

Expr
  = Reference / Literal

Literal
  = n:num
  { return {tag: "literal", value: n}; }

Reference
  = i:ident
  { return {tag: "reference", ident: i}; }


// Tokens.

num "number"
  = DIGIT+
  { return parseInt(text()); }

ident "identifier"
  = ALPHA ALPHANUM*
  { return text(); }


// Empty space.

comment "comment"
  = "#" (!NEWLINE .)*

ws "whitespace"
  = SPACE

_
  = (ws / comment)*


// Character classes.

SPACE = [ \t\r\n\v\f]
ALPHA = [A-Za-z]
DIGIT = [0-9]
ALPHANUM = ALPHA / DIGIT
NEWLINE = [\r\n]
