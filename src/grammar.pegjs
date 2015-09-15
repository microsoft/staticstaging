{
  // From the PEG.js examples.
  function build_list(first, rest, index) {
    return [first].concat(extractList(rest, index));
  }
}

Program
  = _ e:SeqExpr _
  { return e; }


// Syntax.

Expr
  = Let / Fun / Binary / Call / TermExpr

SeqExpr
  = Seq / Expr

TermExpr
  = Literal / Lookup / Quote / Escape / Run

Seq
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
  = escape_open _ e:SeqExpr _ escape_close
  { return {tag: "escape", expr: e}; }

Run "run"
  = run _ e:TermExpr
  { return {tag: "run", expr: e}; }

Fun "lambda"
  = fun _ ps:Param* _ arrow _ e:Expr
  { return {tag: "fun", params: ps, body: e}; }
Param
  = i:ident _ typed _ t:ident _
  { return {name: i, type: t}; }

Call "call"
  = i:TermExpr _ as:Arg+
  { return {tag: "call", fun: i, args: as}; }
Arg
  = e:TermExpr _
  { return e; }


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

fun "fun"
  = "fun"

arrow "arrow"
  = "->"

typed "type marker"
  = ":"

comma "comma"
  = ","


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
