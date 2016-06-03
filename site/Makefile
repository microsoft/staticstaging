.PHONY: all
all: index.html main.css main.js

%.html: %.md template.html
	pandoc -s --template template.html -o $@ --smart $<

FRAMEWORK := bower_components/bootstrap/scss/bootstrap.scss
RIBBON := bower_components/github-fork-ribbon-css/gh-fork-ribbon.css
%.css: %.scss $(FRAMEWORK) dingus/dingus.tools.scss $(RIBBON)
	sassc $< > $@

$(FRAMEWORK):
	bower install bootstrap\#v4.0.0-alpha.2
	@touch $@

$(RIBBON):
	bower install github-fork-ribbon-css
	@touch $@

%.js: %.ts
	tsc $^

.PHONY: watch
SOURCE := index.md main.scss main.ts
watch:
	liveserve $(SOURCE:%=-w %) -x make
