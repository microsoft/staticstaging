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
  = Var / Extern / Fun / CDef / If / While / Binary / Unary / Assign /
  CCall / Call / MacroCall / TermExpr

SeqExpr
  = Seq / HalfSeq / Expr

// Expressions that usually don't need parenthesization.
TermExpr
  = Quote / CCall / Lookup / Escape / Run / FloatLiteral / IntLiteral /
  StringLiteral / Paren

// Expressions that can be operands to binary/unary operators.
Operand
  = If / Call / MacroCall / TermExpr

Seq
  = lhs:Expr _ seq _ rhs:SeqExpr
  { return {tag: "seq", lhs: lhs, rhs: rhs}; }

// Allow (and ignore) a trailing semicolon.
HalfSeq
  = lhs:Expr _ seq
  { return lhs; }

IntLiteral
  = n:int
  { return {tag: "literal", type: "int", value: n}; }

FloatLiteral
  = n:float
  { return {tag: "literal", type: "float", value: n}; }

StringLiteral "string"
  = strquote chars:StringChar* strquote
  { return {tag: "literal", type: "string", value: chars.join("")}; }

StringChar
  = !strquote .
  { return text(); }

Lookup
  = i:ident
  { return {tag: "lookup", ident: i}; }

Var
  = var _ i:ident _ eq _ e:Expr
  { return {tag: "let", ident: i, expr: e}; }

Unary
  = op:unop _ e:Operand
  { return {tag: "unary", expr: e, op: op}; }

Binary
  = AddBinary / MulBinary
AddBinary
  = lhs:(MulBinary / Operand) _ op:addbinop _ rhs:(Binary / Operand)
  { return {tag: "binary", lhs: lhs, op: op, rhs: rhs}; }
MulBinary
  = lhs:Operand _ op:mulbinop _ rhs:(MulBinary / Operand)
  { return {tag: "binary", lhs: lhs, rhs: rhs, op: op}; }

Quote
  = s:snippet_marker? a:ident? quote_open _ e:SeqExpr _ quote_close
  { return {tag: "quote", expr: e, annotation: a || "", snippet: !!s}; }

// Our three kinds of escapes.
Escape
  = Splice / Persist / Snippet
Splice "splice escape"
  = n:int? escape_open _ e:SeqExpr _ escape_close sn:int?
  { return {tag: "escape", expr: e, count: n || sn || 1, kind: "splice"}; }
Persist "persist escape"
  = persist_marker n:int? escape_open _ e:SeqExpr _ escape_close sn:int?
  { return {tag: "escape", expr: e, count: n || sn || 1, kind: "persist"}; }
Snippet "snippet escape"
  = snippet_marker n:int? escape_open _ e:SeqExpr _ escape_close sn:int?
  { return {tag: "escape", expr: e, count: n || sn || 1, kind: "snippet"}; }

Run
  = run _ e:TermExpr
  { return {tag: "run", expr: e}; }

Fun
  = fun _ ps:Param* _ arrow _ e:Expr
  { return {tag: "fun", params: ps, body: e}; }
Param
  = i:ident _ typed _ t:TermType _
  { return {tag: "param", name: i, type: t}; }

CDef
  = def _ i:ident _ paren_open _ ps:CParamList _ paren_close _ e:Expr
  { return {tag: "let", ident: i, expr: {tag: "fun", params: ps, body: e} }; }
CParamList
  = first:CParam rest:CParamMore*
  { return [first].concat(rest); }
CParamMore
  = comma _ p:CParam
  { return p; }
CParam
  = i:ident _ typed _ t:Type _
  { return {tag: "param", name: i, type: t}; }

// This is a little hacky, but we currently require whitespace when the callee
// is an identifier (a lookup). This resolves a grammar ambiguity with quote
// annotations, e.g., `js<1>` vs. `js <1>`.
Call
  = OtherCall / IdentCall
IdentCall
  = i:Lookup ws _ as:Arg+
  { return {tag: "call", fun: i, args: as}; }
OtherCall
  = i:(CCall / Escape / Run / Paren) _ as:Arg+
  { return {tag: "call", fun: i, args: as}; }
Arg
  = e:TermExpr _
  { return e; }

CCall
  = i:Lookup paren_open _ as:CArgList? _ paren_close
  { return {tag: "call", fun: i, args: as || []}; }
CArgList
  = first:Expr rest:CArgMore*
  { return [first].concat(rest); }
CArgMore
  = _ comma _ e:Expr
  { return e; }

MacroCall
  = macromark i:ident _ as:Arg+
  { return {tag: "macrocall", macro: i, args: as}; }

Extern
  = extern _ i:ident _ typed _ t:Type e:ExternExpansion?
  { return {tag: "extern", name: i, type: t, expansion: e}; }
ExternExpansion
  = _ eq _ s:string
  { return s; }

Paren
  = paren_open _ e:SeqExpr _ paren_close
  { return e; }

Assign
  = i:ident _ eq _ e:Expr
  { return {tag: "assign", ident: i, expr: e}; }

If
  = if _ c:TermExpr _ t:TermExpr _ f:TermExpr
  { return {tag: "if", cond: c, truex: t, falsex: f}; }

While
  = while _ c:TermExpr _ b:TermExpr
  { return {tag: "while", cond: c, body: b}; }


// Type syntax.

Type
  = FunType / InstanceType / TermType

TermType
  = CodeType / PrimitiveType / ParenType

PrimitiveType
  = i:ident
  { return {tag: "type_primitive", name: i}; }

InstanceType
  = t:TermType _ i:ident
  { return {tag: "type_instance", name: i, arg: t}; }

ParenType
  = paren_open _ t:Type _ paren_close
  { return t; }

FunType
  = p:FunTypeParam* arrow _ r:TermType
  { return {tag: "type_fun", params: p, ret: r}; }

CodeType
  = s:snippet_marker? a:ident? quote_open _ t:Type _ quote_close
  { return {tag: "type_code", inner: t, annotation: a || "", snippet: !!s}; }

FunTypeParam
  = t:TermType _
  { return t; }


// Tokens.

int "integer"
  = DIGIT+
  { return parseInt(text()); }

float "float"
  = DIGIT+ [.] DIGIT+
  { return parseFloat(text()); }

ident "identifier"
  = (ALPHA / [_]) (ALPHA / DIGIT / [_.])* SUFFIX*
  { return text(); }

string "string"
  = ["] [^"]* ["]
  { return text().slice(1, -1); }

var
  = "var"

eq
  = "="

seq
  = ";"

addbinop
  = [+\-]
mulbinop
  = [*/]

unop "unary operator"
  = [+\-]

quote_open "quote start"
  = "<"

quote_close "quote end"
  = ">"

escape_open
  = "["

escape_close
  = "]"

persist_marker
  = "%"

run "run operator"
  = "!"

fun
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

extern
  = "extern"

def
  = "def"

quote
  = ["]

snippet_marker
  = "$"

if
  = "if"

while
  = "while"

macromark
  = "@"

strquote
  = '"'


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
SUFFIX = [\?\!]
NEWLINE = [\r\n]
