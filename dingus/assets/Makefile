# This Makefile fetches demo assets (to avoid including large files owned by
# someone else in this source repository).

.PHONY: all
all: teapot.obj

teapot.obj: teapot.zip
	unzip $^ $@

teapot.zip:
	curl -LO "http://graphics.cs.williams.edu/data/meshes/teapot.zip"
