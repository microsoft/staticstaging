PLOTS := latencies.pdf latencies-phong.pdf latencies-head.pdf latencies-couch.pdf

.PHONY: all
all: $(PLOTS)

.PHONY: view
view: $(PLOTS)
	open $(PLOTS)

latencies.svg: latencies.vl.json ../latencies.json

# Sadly, make doesn't seem to let use % in this context (where we're adding
# dependencies to an existing template rule). :cry:
latencies-phong.svg: latencies-phong.vl.json latencies-phong.json
latencies-head.svg: latencies-head.vl.json latencies-head.json

latencies-%.vl.json: latencies-%.json latencies.vl.json prevl.js
	node prevl.js data.url=$< $(PREVL) < latencies.vl.json > $@

# No y-axis label on plots other than the leftmost.
latencies-head.vl.json: PREVL = layers.0.encoding.y.axis.title=
latencies-couch.vl.json: PREVL = layers.0.encoding.y.axis.title=

latencies-%.json: %.names.json ../latencies.json ../subset.py
	python3 ../subset.py $< < ../latencies.json > $@

.PHONY: clean
clean:
	rm -f *.png *.svg *.pdf prevl.js latencies-*.json

%.png: %.vl.json
	vl2png $< > $@

%.svg: %.vl.json
	vl2svg $< > $@

# A little one-liner to simplify the CSS in the SVGs produced by Vega-Lite.
# rsvg-convert doesn't seem to support the `font` attribute, but it does work
# with a separate `font-family` attribute. We can fix that!
FIX_SVG := ( \
	perl -pe 's/font: bold ([^\s]*) ([^;]*);/font-weight: bold; font-size: \1; font-family: \2;/g' | \
	perl -pe 's/font: ([^\s]*) ([^;]*);/font-size: \1; font-family: \2;/g' \
	)

%.pdf: %.svg
	$(FIX_SVG) < $< | rsvg-convert -f pdf > $@

# A little vega-lite authoring tool.
prevl.js: prevl.ts
	tsc --target es5 --module commonjs --lib es5,es2015.promise $<
