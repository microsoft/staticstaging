PLOTS := latencies.pdf latencies-phong.pdf

.PHONY: all
all: $(PLOTS)

.PHONY: view
view: $(PLOTS)
	open $(PLOTS)

latencies.svg: latencies.vl.json ../latencies.json

latencies-phong.svg: latencies-phong.vl.json latencies-phong.json

latencies-phong.vl.json: latencies.vl.json prevl.js
	node prevl.js latencies-phong.json < $< > $@

latencies-phong.json: ../latencies.json phong.names.json ../subset.py
	python3 ../subset.py phong.names.json < $< > $@

.PHONY: clean
clean:
	rm -f *.png *.svg *.pdf prevl.js

%.png: %.vl.json
	vl2png $< > $@

%.svg: %.vl.json
	vl2svg $< > $@

%.pdf: %.svg
	rsvg-convert -f pdf $< > $@

# A little vega-lite authoring tool.
prevl.js: prevl.ts
	tsc -target es6 -module commonjs $<
