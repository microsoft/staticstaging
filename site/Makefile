.PHONY: all
all: index.html

%.html: %.md template.html
	pandoc -s --template template.html -o $@ $<
