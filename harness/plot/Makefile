.PHONY: all
all: latencies.svg

%.png: %.vl.json
	vl2png $^ > $@

%.svg: %.vl.json
	vl2svg $^ > $@
