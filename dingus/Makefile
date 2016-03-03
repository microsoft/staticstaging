DINGUS_JS := $(build/dingus/atw.js)
GENERATED_JS := examples.js preambles.js atw.bundle.js

.PHONY: all clean
all: atw.bundle.js
clean:
	rm -rf build/ $(GENERATED_JS)


# Build the TypeScript and JavaScript sources.

TS_SRC := $(shell find ../src/ -type f -name '*.ts')
JS_SRC := gl.js examples.js preambles.js
$(DINGUS_JS): $(TS_SRC) $(JS_SRC) atw.ts typings/browser.d.ts deps
	`npm bin`/tsc


# Bundle the built sources for the Web.

atw.bundle.js: $(DINUS_JS) deps
    `npm bin`/webpack $< $@


# Munge the examples and preamble files.

EXAMPLES := basics splice persist progfunc extern \
	normcolor objects phong
EXAMPLE_FILES := $(EXAMPLES:%=examples/%.atw)
examples.js: munge.js $(EXAMPLE_FILES)
	printf "module.exports = " > $@
	node $< $(EXAMPLE_FILES) >> $@

preambles.js: munge.js gl_preamble.atw
	printf "module.exports = " > $@
	node $< gl_preamble.atw >> $@
