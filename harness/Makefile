HARNESS := node build/harness.js

.PHONY: build
build:
	tsc

.PHONY: collect
collect: $(patsubst bench/%.ss,collected/%.json,$(wildcard bench/*.ss))

collected/%.json: bench/%.ss
	@mkdir -p collected
	$(HARNESS) $^ > $@

.PHONY: summarize
summarize:
	python3 summarize.py
