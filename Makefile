PEGJS = node_modules/pegjs/bin/pegjs

$(PEGJS): package.json
	npm install

grammar.js: grammar.pegjs $(PEGJS)
	$(PEGJS) $(<)
