Program
  = _ e:Expr _
  { return e; }


// Syntax.

Expr "expression"
  = Seq / NonSeq

NonSeq "non-sequence expression"
  = Reference / Literal

Literal "literal"
  = n:num
  { return {tag: "literal", value: n}; }

Reference "variable reference"
  = i:ident
  { return {tag: "reference", ident: i}; }

Seq "sequence"
  = lhs:NonSeq _ SEQ _ rhs:Expr
  { return {tag: "seq", lhs: lhs, rhs: rhs}; }


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
SEQ = ";"
