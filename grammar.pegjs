start
  = space n:ident space
  { return n; }

ident "identifier"
  = head:[A-Za-z] tail:[A-Za-z0-9]*
  { return text(); }

ws "whitespace"
  = [ \t\n\r]*

comment "comment"
  = "#" [^\r]* [\r$]

space
  = comment* ws

num "number"
  = [0-9]+
  { return parseInt(text()); }
