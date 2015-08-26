Program
  = _ e:SeqExpr _
  { return e; }


// Syntax.

Expr "expression"
  = Let / Binary / Run / TermExpr

SeqExpr "expression or sequence"
  = Seq / Expr

TermExpr "atomic expression"
  = Literal / Lookup / Quote / Escape

Seq "sequence"
  = lhs:Expr _ seq _ rhs:SeqExpr
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

Binary "binary operation"
  = lhs:TermExpr _ op:binop _ rhs:Expr
  { return {tag: "binary", lhs: lhs, rhs: rhs, op: op}; }

Quote "quote"
  = quote_open _ e:SeqExpr _ quote_close
  { return {tag: "quote", expr: e}; }

Escape "escape"
  = escape_open _ e: SeqExpr _ escape_close
  { return {tag: "escape", expr: e}; }

Run "run"
  = run _ e:TermExpr
  { return {tag: "run", expr: e}; }


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

seq "semicolon"
  = ";"

binop "binary operator"
  = [+\-*/]
  // If we could use TypeScript here, it would be nice to use a static enum
  // for the operator.

quote_open "quote start"
  = "<"

quote_close "quote end"
  = ">"

escape_open "escape begin"
  = "["

escape_close "escape end"
  = "]"

run "run operator"
  = "!"


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
