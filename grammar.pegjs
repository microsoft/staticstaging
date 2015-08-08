start
  = space e:expr space
  { return e; }

expr
  = ident / num


// Tokens.

num "number"
  = DIGIT+
  { return parseInt(text()); }

ident "identifier"
  = ALPHA ALPHANUM*
  { return text(); }


// Empty space.

comment "comment"
  = "#" NONEOL* EOL?

ws "whitespace"
  = SPACE*

space
  = (ws comment)*


// Character classes.

SPACE = [ \t\r\n\v\f]
ALPHA = [A-Za-z]
DIGIT = [0-9]
ALPHANUM = ALPHA / DIGIT
EOL = [\r\n]
NONEOL = [^\r\n]
