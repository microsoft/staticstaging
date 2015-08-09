PEGJS = node_modules/pegjs/bin/pegjs
TSC = node_modules/typescript/bin/tsc
TSD = node_modules/tsd/build/cli.js
NODE_D = typings/node/node.d.ts
GENERATED = parser.js atw.js
SOURCES = atw.ts interp.ts

.PHONY: all
all: $(GENERATED)

parser.js: grammar.pegjs $(PEGJS)
	$(PEGJS) < $(<) > $@

atw.js: $(SOURCES) $(TSC) $(NODE_D)
	$(TSC) --out $@ $<

$(NODE_D): $(TSD)
	./$< install node

.PHONY: clean
clean:
	rm -rf $(GENERATED) node_modules typings

.PHONY: test
test: all
	node atw.js test/print.atw
	node atw.js test/comment.atw
	node atw.js test/whitespace.atw
	node atw.js test/seq.atw
	node atw.js test/let.atw


# Tools from npm.

$(PEGJS):
	npm install pegjs

$(TSC):
	npm install typescript

$(TSD):
	npm install tsd
