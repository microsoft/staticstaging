PEGJS = node_modules/pegjs/bin/pegjs
TSC = node_modules/typescript/bin/tsc
TSD = node_modules/tsd/build/cli.js
NODE_D = typings/node/node.d.ts
SRCDIR = src
GENERATED = parser.js atw.js
SOURCES = atw.ts interp.ts
TESTS = print comment whitespace seq let add quote dump

.PHONY: all
all: $(GENERATED)

parser.js: $(SRCDIR)/grammar.pegjs $(PEGJS)
	$(PEGJS) < $(<) > $@

# Use TypeScript 1.5 `tsconfig.json` to build.
atw.js: $(SOURCES:%=$(SRCDIR)/%) $(TSC) $(NODE_D) tsconfig.json
	$(TSC)

$(NODE_D): $(TSD)
	./$< install node

.PHONY: clean
clean:
	rm -rf $(GENERATED) node_modules typings

.PHONY: test
test: all
	@ for fn in $(TESTS) ; do \
		echo $$fn ; \
		node atw.js test/$$fn.atw ; \
	done


# Tools from npm.

$(PEGJS):
	npm install pegjs

$(TSC):
	npm install typescript

$(TSD):
	npm install tsd
