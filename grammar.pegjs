Program
  = _ e:ExprSeq _
  { return e; }


// Syntax.

Expr "expression"
  = Let / Literal / Lookup

ExprSeq "expression or sequence"
  = Seq / Expr

Seq "sequence"
  = lhs:Expr _ SEQ _ rhs:ExprSeq
  { return {tag: "seq", lhs: lhs, rhs: rhs}; }

Literal "literal"
  = n:num
  { return {tag: "literal", value: n}; }

Lookup "variable reference"
  = i:ident
  { return {tag: "lookup", ident: i}; }

Let "assignment"
  = let _ i:ident _ eq _ e:Expr
  { return {tag: "let", ident: i, expr: e}; }


// Tokens.

num "number"
  = DIGIT+
  { return parseInt(text()); }

ident "identifier"
  = ALPHA ALPHANUM*
  { return text(); }

let "let"
  = "let"

eq "equals"
  = "="


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
