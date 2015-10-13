{
  // From the PEG.js examples.
  function build_list(first, rest, index) {
    return [first].concat(extractList(rest, index));
  }
}

Program
  = _ e:SeqExpr _
  { return e; }


// Expression syntax.

Expr
  = Let / Fun / Binary / Call / TermExpr

SeqExpr
  = Seq / Expr

TermExpr
  = Quote / Literal / Lookup / Splice / Persist / Run / Paren

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
  = a:ident? quote_open _ e:SeqExpr _ quote_close
  { return {tag: "quote", expr: e, annotation: a || ""}; }

Splice "splice escape"
  = splice_open _ e:SeqExpr _ splice_close
  { return {tag: "escape", expr: e, kind: "splice"}; }

Persist "persist escape"
  = persist_open _ e:SeqExpr _ persist_close
  { return {tag: "escape", expr: e, kind: "persist"}; }

Run "run"
  = run _ e:TermExpr
  { return {tag: "run", expr: e}; }

Fun "lambda"
  = fun _ ps:Param* _ arrow _ e:Expr
  { return {tag: "fun", params: ps, body: e}; }

Param "parameter"
  = i:ident _ typed _ t:TermType _
  { return {tag: "param", name: i, type: t}; }

Call "call"
  = i:TermExpr _ as:Arg+
  { return {tag: "call", fun: i, args: as}; }
Arg
  = e:TermExpr _
  { return e; }

Paren "parentheses"
  = paren_open _ e:Expr _ paren_close
  { return e; }


// Type syntax.

Type "type"
  = FunType / TermType

TermType
  = PrimitiveType / ParenType

PrimitiveType "primitive type"
  = i:ident
  { return {tag: "type_primitive", name: i}; }

ParenType
  = paren_open _ t:Type _ paren_close
  { return t; }

FunType "function type"
  = p:FunTypeParam* arrow _ r:TermType
  { return {tag: "type_fun", params: p, ret: r}; }

FunTypeParam
  = t:TermType _
  { return t; }


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

splice_open "splice start"
  = "["

splice_close "splice end"
  = "]"

persist_open "persist start"
  = "%["

persist_close "persist end"
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

paren_open
  = "("

paren_close
  = ")"


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
