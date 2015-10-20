SRCDIR := src
SOURCES := interp.ts ast.ts visit.ts pretty.ts type.ts util.ts sugar.ts \
	compile.ts backends.ts backend_js.ts backend_glsl.ts backend_webgl.ts
TESTS_BASIC := print comment whitespace seq let add quote escape nestedrun \
	nested func call quotefunc closure persist nestedpersist share sharemulti \
	quotelet splicepersist paren parentype higherorder codearg
TESTS_INTERP := dump splice nesteddump spdump
TESTS_TYPE := typeerror badsplice topescape
TESTS_WEBGL := gl-quote gl-persist gl-vtxfrag
TSCARGS := --noImplicitAny

SRC_FILES := $(SOURCES:%=$(SRCDIR)/%)
CLI_JS := parser.js atw.js
DINGUS_JS := dingus/atw.js dingus/parser.js
GENERATED := $(CLI_JS) $(DINGUS_JS)

.PHONY: cli dingus all
cli: $(CLI_JS)
dingus: $(DINGUS_JS)
all: cli dingus

.PHONY: clean
clean:
	rm -rf $(GENERATED) node_modules typings

.PHONY: deploy
RSYNCARGS := --compress --recursive --checksum --delete -e ssh
DEST := dh:domains/adriansampson.net/atw
deploy: dingus
	rsync $(RSYNCARGS) dingus/ $(DEST)


# Tools and dependencies from npm.

PEGJS := node_modules/pegjs/bin/pegjs
TSC := node_modules/typescript/bin/tsc
TSD := node_modules/tsd/build/cli.js
MINIMIST := node_modules/minimist/package.json

$(PEGJS): node_modules/pegjs/package.json
$(TSC): node_modules/typescript/package.json
$(TSD): node_modules/tsd/package.json

node_modules/%/package.json:
	npm install $*
	@touch $@


# Typings from tsd.

NODE_D := typings/node/node.d.ts
MINIMIST_D := typings/minimist/minimist.d.ts

typings/%.d.ts: $(TSD)
	$(TSD) install $(firstword $(subst /, ,$*))
	@touch $@


# The command-line Node tool.

CLI_SRCS := $(SRC_FILES) atw.ts $(NODE_D) $(MINIMIST_D)
atw.js: $(TSC) $(CLI_SRCS) $(MINIMIST)
	$(TSC) $(TSCARGS) --out $@ $(CLI_SRCS)

parser.js: $(SRCDIR)/grammar.pegjs $(PEGJS)
	$(PEGJS) < $(<) > $@


# The Web dingus.

WEB_SRCS := $(SRC_FILES) dingus/atw.ts
dingus/atw.js: $(TSC) $(WEB_SRCS)
	$(TSC) $(TSCARGS) --out $@ $(WEB_SRCS)

dingus/parser.js: $(SRCDIR)/grammar.pegjs $(PEGJS)
	$(PEGJS) --export-var parser < $(<) > $@



# Running tests.

define run_tests
for name in $1 ; do \
	sh test.sh $2 test/$$name.atw ; \
	if [ $$? -ne 0 ] ; then failed=1 ; fi ; \
done
endef

TEST_COMPILE := $(call run_tests,$(TESTS_BASIC),-cx)
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
test: $(CLI_JS)
	@ echo "interpreter" ; \
	$(TEST_INTERP) ; \
	echo ; \
	echo "compiler" ; \
	$(TEST_COMPILE) ; \
	$(TEST_FAIL)

# Just dump the output code for the WebGL examples.
.PHONY: dump-gl
dump-gl: $(CLI_JS)
	@for name in $(TESTS_WEBGL) ; do \
		echo $$name ; \
		node atw.js -cw test/$$name.atw ; \
		if [ $$? -ne 0 ] ; then failed=1 ; fi ; \
	done ; \
	$(TEST_FAIL)
