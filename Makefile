SRCDIR := src
SOURCES := interp.ts ast.ts visit.ts pretty.ts util.ts driver.ts \
	type.ts type_check.ts type_elaborate.ts sugar.ts \
	compile/compile.ts compile/ir.ts compile/defuse.ts \
	compile/scope.ts compile/lift.ts compile/presplice.ts \
	backends/emitutil.ts backends/js.ts backends/glsl.ts backends/webgl.ts \
	backends/emitter.ts backends/gl.ts
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
TYPINGS := node_modules/.bin/typings
MINIMIST := node_modules/minimist/package.json

$(PEGJS): node_modules/pegjs/package.json
$(TSC): node_modules/typescript/package.json
$(TYPINGS): node_modules/typings/package.json

node_modules/%/package.json:
	npm install $*
	@touch $@


# Typings.

typings/%.d.ts: typings.json $(TYPINGS)
	$(TYPINGS) install


# The command-line Node tool.

CLI_SRCS := $(SRC_FILES) atw.ts typings/main.d.ts
atw.js: $(TSC) $(CLI_SRCS) $(MINIMIST)
	$(TSC) $(TSCARGS) --out $@ $(CLI_SRCS)

parser.js: $(SRCDIR)/grammar.pegjs $(PEGJS)
	$(PEGJS) --cache < $(<) > $@


# The Web dingus.

dingus: $(DINGUS_JS) dingus/gl.bundle.js dingus/d3.js dingus/examples.js \
	dingus/codemirror dingus/preambles.js

WEB_SRCS := $(SRC_FILES) dingus/atw.ts typings/browser.d.ts
dingus/atw.js: $(TSC) $(WEB_SRCS)
	$(TSC) $(TSCARGS) --out $@ $(WEB_SRCS)

dingus/parser.js: $(SRCDIR)/grammar.pegjs $(PEGJS)
	$(PEGJS) --cache < $(<) > $@

dingus/gl.bundle.js: dingus/gl.js dingus/package.json
	cd dingus ; npm install
	cd dingus ; npm run build

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

# Munge the examples and preamble files.
DINGUS_EXAMPLES := basics splice persist progfunc extern \
	normcolor objects phong
DINGUS_EXAMPLE_FILES := $(DINGUS_EXAMPLES:%=dingus/examples/%.atw)
dingus/examples.js: munge.js $(DINGUS_EXAMPLE_FILES)
	printf "ATW_EXAMPLES = " > $@
	node $< $(DINGUS_EXAMPLE_FILES) >> $@

dingus/preambles.js: munge.js dingus/gl_preamble.atw
	printf "ATW_PREAMBLES = " > $@
	node $< dingus/gl_preamble.atw >> $@


# Running tests.

define run_tests
for name in $1 ; do \
	sh test.sh $2 $$name ; \
	if [ $$? -ne 0 ] ; then failed=1 ; fi ; \
done
endef

TESTS_BASIC := $(wildcard test/basic/*.atw) $(wildcard test/snippet/*.atw) \
	$(wildcard test/if/*.atw)
TESTS_COMPILE := $(TESTS_BASIC) $(wildcard test/compile/*.atw)
TESTS_INTERP := $(TESTS_BASIC) $(wildcard test/static/*.atw) \
	$(wildcard test/interp/*.atw)

.PHONY: test-compile
test-compile: $(CLI_JS)
	@ node atw.js -t -cx $(TESTS_COMPILE)

.PHONY: test-interp
test-interp: $(CLI_JS)
	@ node atw.js -t $(TESTS_INTERP)

.PHONY: test
test: $(CLI_JS)
	@ echo "interpreter" ; \
	node atw.js -t $(TESTS_INTERP) || failed=1 ; \
	echo ; \
	echo "compiler" ; \
	node atw.js -t -cx $(TESTS_COMPILE) || failed=1 ; \
	[ ! $$failed ]

# Just dump the output code for the WebGL examples.
.PHONY: dump-gl
dump-gl: $(CLI_JS)
	@ node atw.js -cw $(wildcard test/webgl/*.atw)


# An asset-munging utility.

# Compile the example-munging script.
munge.js: munge.ts $(TSC) typings/main.d.ts
	$(TSC) $(TSCARGS) --out $@ $<


# Documentation.

MADOKO := node_modules/.bin/madoko
$(MADOKO): node_modules/madoko/package.json

.PHONY: docs
docs: docs/build/index.html docs/build/docs.js

docs/build/index.html: docs/index.md $(MADOKO)
	cd docs; ../$(MADOKO) --odir=build ../$<

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
		-p 'src/**/*.ts' 'src/*.pegjs' atw.ts -t cli \
		-p 'src/**/*.ts' 'src/*.pegjs' 'dingus/*.ts' 'dingus/gl.js' \
			'dingus/examples/*.atw' -t dingus
