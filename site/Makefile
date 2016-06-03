.PHONY: all
all: index.html main.css

%.html: %.md template.html
	pandoc -s --template template.html -o $@ --smart $<

FRAMEWORK := bower_components/bootstrap/scss/bootstrap.scss
%.css: %.scss $(FRAMEWORK)
	sassc $< > $@

$(FRAMEWORK):
	bower install bootstrap\#v4.0.0-alpha.2
	@touch $@
