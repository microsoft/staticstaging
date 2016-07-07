HARNESS := node build/harness.js

.PHONY: collect
collect: $(patsubst bench/%.ss,collected/%.json,$(wildcard bench/*.ss))

collected/%.json: bench/%.ss
	@mkdir -p collected
	$(HARNESS) $^ > $@
