start
  = ident

ident
  = name:[A-Za-z][A-Za-z0-9]* { return name; }
