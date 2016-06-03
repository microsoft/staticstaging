.PHONY: all
all: index.html main.css

%.html: %.md template.html
	pandoc -s --template template.html -o $@ $<

%.css: %.scss bower_components/concise/bower.json
	sassc $< > $@

bower_components/%/bower.json:
	bower install $*
	touch $@
