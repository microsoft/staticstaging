.PHONY: all
all: index.html main.css

%.html: %.md template.html
	pandoc -s --template template.html -o $@ $<

%.css: %.scss bower_components/concise/src/concise.scss
	sassc $< > $@

bower_components/concise/src/concise.scss:
	bower install concise
	@touch $@
