PLOTS := latencies.pdf

.PHONY: all
all: $(PLOTS)

.PHONY: view
view: $(PLOTS)
	open $(PLOTS)

latencies.svg: latencies.vl.json ../latencies.json

.PHONY: clean
clean:
	rm -f *.png *.svg *.pdf

%.png: %.vl.json
	vl2png $< > $@

%.svg: %.vl.json
	vl2svg $< > $@

%.pdf: %.svg
	rsvg-convert -f pdf $< > $@
