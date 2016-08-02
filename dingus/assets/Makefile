# This Makefile fetches demo assets (to avoid including large files owned by
# someone else in this source repository).

.PHONY: all
all: teapot.obj head.obj lambertian.jpg cube.obj default.png

teapot.obj: teapot.zip
	unzip $^ $@
	touch $@

teapot.zip:
	curl -LO "http://graphics.cs.williams.edu/data/meshes/$@"

head.OBJ: head.zip
	unzip $^ $@
	touch $@

head.obj: head.OBJ
	mv $^ $@

lambertian.jpg: head.zip
	unzip $^ $@
	touch $@

head.zip:
	curl -LO "http://graphics.cs.williams.edu/data/meshes/$@"

default.png: cube.zip
	unzip $^ $@
	touch $@

cube.zip:
	curl -LO "http://graphics.cs.williams.edu/data/meshes/$@"
