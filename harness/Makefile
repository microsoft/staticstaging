HARNESS := node build/harness.js

.PHONY: build
build:
	tsc

.PHONY: collect
COLLECTED := $(patsubst bench/%.ss,collected/%.json,$(wildcard bench/*.ss))
collect: $(COLLECTED)

collected/%.json: bench/%.ss
	@mkdir -p collected
	$(HARNESS) $^ > $@

.PHONY: summarize
summarize:
	python3 summarize.py

latencies.json: summarize.py $(COLLECTED)
	python3 $< -j > $@
