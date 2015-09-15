PEGJS := node_modules/pegjs/bin/pegjs
TSC := node_modules/typescript/bin/tsc
TSD := node_modules/tsd/build/cli.js
NODE_D := typings/node/node.d.ts
SRCDIR := src
SOURCES := interp.ts ast.ts visit.ts pretty.ts type.ts util.ts
TESTS := print comment whitespace seq let add quote dump typeerror escape \
	splice badsplice topescape nesteddump nestedrun nested func
TSCARGS := --noImplicitAny

SRC_FILES := $(SOURCES:%=$(SRCDIR)/%)
CLI_JS := parser.js atw.js
DINGUS_JS := dingus/atw.js dingus/parser.js
GENERATED := $(CLI_JS) $(DINGUS_JS)

.PHONY: cli dingus all
cli: $(CLI_JS)
dingus: $(DINGUS_JS)
all: cli dingus

# Build the command-line Node tool.
CLI_SRCS := $(SRC_FILES) atw.ts $(NODE_D)
atw.js: $(TSC) $(CLI_SRCS)
	$(TSC) $(TSCARGS) --out $@ $(CLI_SRCS)

$(NODE_D): $(TSD)
	./$< install node

parser.js: $(SRCDIR)/grammar.pegjs $(PEGJS)
	$(PEGJS) < $(<) > $@

# Build the browser dingus.
WEB_SRCS := $(SRC_FILES) dingus/atw.ts
dingus/atw.js: $(TSC) $(WEB_SRCS)
	$(TSC) $(TSCARGS) --out $@ $(WEB_SRCS)

dingus/parser.js: $(SRCDIR)/grammar.pegjs $(PEGJS)
	$(PEGJS) --export-var parser < $(<) > $@

.PHONY: clean
clean:
	rm -rf $(GENERATED) node_modules typings

.PHONY: test
test: $(CLI_JS)
	@ for fn in $(TESTS) ; do \
	    echo ; \
		echo $$fn ; \
		node atw.js test/$$fn.atw ; \
	done

.PHONY: deploy
RSYNCARGS := --compress --recursive --checksum --delete -e ssh
DEST := dh:domains/adriansampson.net/atw
deploy: dingus
	rsync $(RSYNCARGS) dingus/ $(DEST)


# Tools from npm.

$(PEGJS): node_modules/pegjs/package.json
$(TSC): node_modules/typescript/package.json
$(TSD): node_modules/tsd/package.json

node_modules/%/package.json:
	npm install $*
