PEGJS = node_modules/pegjs/bin/pegjs
TSC = node_modules/typescript/bin/tsc
TSD = node_modules/tsd/build/cli.js
NODE_D = typings/node/node.d.ts

.PHONY: all
all: parser.js atw.js

parser.js: grammar.pegjs $(PEGJS)
	$(PEGJS) < $(<) > $@

%.js: %.ts $(TSC) $(NODE_D)
	$(TSC) $<

$(NODE_D): $(TSD)
	./$< install node


# Tools from npm.

$(PEGJS):
	npm install pegjs

$(TSC):
	npm install typescript

$(TSD):
	npm install tsd
