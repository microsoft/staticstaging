SRCDIR := src
SOURCES := interp.ts ast.ts visit.ts pretty.ts util.ts driver.ts \
	type.ts type_check.ts type_elaborate.ts \
	sugar.ts compile.ts \
	backends.ts backend_js.ts backend_glsl.ts backend_webgl.ts
TESTS_BASIC := print seq let add unary quote escape nestedrun \
	nested func call quotefunc closure persist nestedpersist share sharemulti \
	quotelet splicepersist paren parentype higherorder codearg \
	extern externfunc mutate externmutate externmutateuse externnamed float \
	bug-nestedcapture bug-nestedcapture2 bug-externcapture \
	progfunc progfunc-persist progfunc-func \
	annotation-ok
TESTS_INTERP := dump splice nesteddump spdump
TESTS_STATIC := trailingsemi comment whitespace \
	typeerror badsplice topescape floaterror ccall ccall-expr cdef \
	assoc assoc2 \
	annotation-error
TESTS_WEBGL := gl-quote gl-persist gl-vtxfrag gl-outputs gl-types gl-vec4 \
	gl-array gl-overload gl-typeadapt gl-normcolor
TSCARGS := --noImplicitAny

SRC_FILES := $(SOURCES:%=$(SRCDIR)/%)
CLI_JS := parser.js atw.js
DINGUS_JS := dingus/atw.js dingus/parser.js
GENERATED := $(CLI_JS) $(DINGUS_JS)

.PHONY: cli dingus all
cli: $(CLI_JS)
all: cli dingus

.PHONY: clean
clean:
	rm -rf $(GENERATED) node_modules typings


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
CODEMIRROR_D := typings/codemirror/codemirror.d.ts

typings/%.d.ts: $(TSD)
	$(TSD) install $(firstword $(subst /, ,$*))
	@touch $@


# The command-line Node tool.

CLI_SRCS := $(SRC_FILES) atw.ts $(NODE_D) $(MINIMIST_D)
atw.js: $(TSC) $(CLI_SRCS) $(MINIMIST)
	$(TSC) $(TSCARGS) --out $@ $(CLI_SRCS)

parser.js: $(SRCDIR)/grammar.pegjs $(PEGJS)
	$(PEGJS) --cache < $(<) > $@


# The Web dingus.

dingus: $(DINGUS_JS) dingus/gl.bundle.js dingus/d3.js dingus/examples.js \
	dingus/codemirror

WEB_SRCS := $(SRC_FILES) dingus/atw.ts $(CODEMIRROR_D)
dingus/atw.js: $(TSC) $(WEB_SRCS)
	$(TSC) $(TSCARGS) --out $@ $(WEB_SRCS)

dingus/parser.js: $(SRCDIR)/grammar.pegjs $(PEGJS)
	$(PEGJS) --export-var parser < $(<) > $@

dingus/gl.bundle.js: dingus/gl.js dingus/package.json
	cd dingus ; npm install
	cd dingus ; npm run-script build

D3 := dingus/bower_components/d3/d3.min.js
$(D3):
	cd dingus ; bower install d3
	@touch $@
dingus/d3.js: $(D3)
	cp $< $@

CODEMIRROR := dingus/bower_components/codemirror/lib
$(CODEMIRROR):
	cd dingus ; bower install codemirror
	@touch $@
dingus/codemirror: $(CODEMIRROR)
	cp -r $< $@

# Munge the examples.
DINGUS_EXAMPLES := basics splice persist progfunc extern \
	normcolor objects phong bug
DINGUS_EXAMPLE_FILES := $(DINGUS_EXAMPLES:%=dingus/examples/%.atw)
dingus/examples.js: munge.js $(DINGUS_EXAMPLE_FILES)
	printf "ATW_EXAMPLES = " > $@
	node $< $(DINGUS_EXAMPLE_FILES) >> $@


# Running tests.

define run_tests
for name in $1 ; do \
	sh test.sh $2 test/$$name.atw ; \
	if [ $$? -ne 0 ] ; then failed=1 ; fi ; \
done
endef

TEST_COMPILE := $(call run_tests,$(TESTS_BASIC),-cx)
TEST_INTERP := $(call run_tests,$(TESTS_BASIC) $(TESTS_STATIC) $(TESTS_INTERP),)
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


# An asset-munging utility.

# Compile the example-munging script.
munge.js: munge.ts $(TSC) $(NODE_D)
	$(TSC) $(TSCARGS) --out $@ $<


# Documentation.

MADOKO := node_modules/.bin/madoko
$(MADOKO): node_modules/madoko/package.json

.PHONY: docs
docs: docs/build/index.html docs/build/docs.js

docs/build/index.html: docs/index.md $(MADOKO)
	$(MADOKO) --odir=docs/build $<

docs/build/docs.js: docs/docs.ts $(TSC)
	$(TSC) $(TSCARGS) --out $@ $<


# Deploy the dingus and docs.

.PHONY: deploy
RSYNCARGS := --compress --recursive --checksum --delete -e ssh \
	--exclude node_modules --exclude package.json --exclude gl.js \
	--exclude '*.ts' --exclude bower_components --exclude docs
DEST := dh:domains/adriansampson.net/atw
deploy: dingus docs
	rsync $(RSYNCARGS) dingus/ $(DEST)
	rsync $(RSYNCARGS) docs/build/ $(DEST)/docs


# Auto-build using https://facebook.github.io/watchman/

.PHONY: watch
watch:
	watchman-make --settle 0.1 \
		-p 'docs/*.md' 'docs/*.ts' -t docs \
		-p 'src/*.ts' 'src/*.pegjs' atw.ts -t cli \
		-p 'src/*.ts' 'src/*.pegjs' 'dingus/*.ts' 'dingus/gl.js' \
			'dingus/examples/*.atw' -t dingus
