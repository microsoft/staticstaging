PEGJS = node_modules/pegjs/bin/pegjs

$(PEGJS): package.json
	npm install

parser.js: grammar.pegjs $(PEGJS)
	$(PEGJS) < $(<) > $@
