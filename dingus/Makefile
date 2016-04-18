DINGUS_JS := build/dingus/atw.js
GENERATED := examples.js preambles.js atw.bundle.js codemirror.css dingus.css

.PHONY: all clean
all: atw.bundle.js codemirror.css dingus.css
clean:
	rm -rf build/ node_modules/ $(GENERATED)

include ../ts.mk


# Build the TypeScript and JavaScript sources.

TS_SRC := $(shell find ../src/ -type f -name '*.ts')
JS_SRC := gl.js examples.js preambles.js ../parser.js
$(DINGUS_JS): $(TS_SRC) $(JS_SRC) atw.ts $(TYPINGS_BROWSER) $(TSC)
	$(TSC)

# It's a shame we have to duplicate this rule here.
../parser.js: ../src/grammar.pegjs
	make -C .. parser.js


# Bundle the built sources for the Web.

atw.bundle.js: $(DINGUS_JS) $(call npmdep,webpack)
	$(call npmbin,webpack) $< $@


# Build the CSS.

dingus.css: dingus.scss
	sassc $< > $@


# Copy the CSS resource we need.

codemirror.css: $(call npmdep,codemirror)
	cp node_modules/codemirror/lib/codemirror.css $@


# Munge the examples and preamble files.

MUNGE := ../tool/munge.js
$(MUNGE):
	make -C .. tool/munge.js

EXAMPLES := basics splice persist progfunc extern \
	presplice macro normcolor objects phong
EXAMPLE_FILES := $(EXAMPLES:%=examples/%.atw)
examples.js: $(MUNGE) $(EXAMPLE_FILES)
	printf "module.exports = " > $@
	node $< $(EXAMPLE_FILES) >> $@

preambles.js: $(MUNGE) gl_preamble.atw
	printf "module.exports = " > $@
	node $< gl_preamble.atw >> $@
