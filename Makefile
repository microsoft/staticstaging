PEGJS = node_modules/pegjs/bin/pegjs
TSC = node_modules/typescript/bin/tsc

.PHONY: all
all: parser.js atw.js

$(PEGJS):
	npm install pegjs

$(TSC):
	npm install typescript

parser.js: grammar.pegjs $(PEGJS)
	$(PEGJS) < $(<) > $@

%.js: %.ts $(TSC)
	$(TSC) $<
