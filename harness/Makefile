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

# Generate program variants.
.PHONY: variants
variants: bench/phong-specular.ss

bench/phong-specular.ss: bench/phong.ss
	python3 knob.py < $< > $@
