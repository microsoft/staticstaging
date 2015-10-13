PEGJS := node_modules/pegjs/bin/pegjs
TSC := node_modules/typescript/bin/tsc
TSD := node_modules/tsd/build/cli.js
NODE_D := typings/node/node.d.ts
SRCDIR := src
SOURCES := interp.ts ast.ts visit.ts pretty.ts type.ts util.ts sugar.ts \
	compile.ts backend_js.ts
TESTS_BASIC := print comment whitespace seq let add quote escape nestedrun \
	nested func call quotefunc closure persist nestedpersist share sharemulti \
	quotelet splicepersist paren parentype
TESTS_INTERP := dump splice nesteddump spdump
TESTS_TYPE := typeerror badsplice topescape
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


# Running tests.

define run_tests
for name in $1 ; do \
	sh test.sh $2 test/$$name.atw ; \
	if [ $$? -ne 0 ] ; then failed=1 ; fi ; \
done
endef

TEST_COMPILE := $(call run_tests,$(TESTS_BASIC),-c -x)
TEST_INTERP := $(call run_tests,$(TESTS_BASIC) $(TESTS_TYPE) $(TESTS_INTERP),)
TEST_FAIL := [ ! $$failed ]

.PHONY: test-compile
test-compile: $(CLI_JS)
	@ $(TEST_COMPILE) ; \
	$(TEST_FAIL)

.PHONY: test-interp
test-interp: $(CLI_JS)
	@ $(TEST_INTERP) ; \
	$(TEST_FAIL)

.PHONY: test
test:
	@ echo "interpreter" ; \
	$(TEST_INTERP) ; \
	echo ; \
	echo "compiler" ; \
	$(TEST_COMPILE) ; \
	$(TEST_FAIL)
