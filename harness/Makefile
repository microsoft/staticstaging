HARNESS := node build/harness.js

# Build the harness.
.PHONY: build
build:
	tsc

# Collect performance data.
.PHONY: collect
COLLECTED := $(patsubst bench/%.ss,collected/%.json,$(wildcard bench/*.ss))
collect: $(COLLECTED)

collected/%.json: bench/%.ss
	@mkdir -p collected
	$(HARNESS) $^ > $@

# Analyze results.
.PHONY: summarize
summarize:
	python3 summarize.py

latencies.json: summarize.py $(COLLECTED)
	python3 $< -j > $@

latencies.mdk: summarize.py $(COLLECTED)
	python3 $< -m > $@

# Generate program variants.
.PHONY: variants
variants: bench/phong-stif-diffuse.ss bench/head-macro-nobump.ss

bench/phong-stif-diffuse.ss: bench/phong-stif.ss
	python3 knob.py < $< > $@

bench/head-macro-nobump.ss: bench/head-macro.ss
	python3 knob.py < $< > $@
