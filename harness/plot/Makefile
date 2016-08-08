.PHONY: all
all: latencies.pdf

%.png: %.vl.json
	vl2png $^ > $@

%.svg: %.vl.json
	vl2svg $^ > $@

%.pdf: %.svg
	rsvg-convert -f pdf $^ > $@
