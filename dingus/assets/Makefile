# This Makefile fetches demo assets (to avoid including large files owned by
# someone else in this source repository).

.PHONY: all
all: teapot.obj head.obj lambertian.jpg bump-lowRes.png default.png

# Teapot.
teapot.obj: teapot.zip
	unzip $^ $@
	touch $@
teapot.zip:
	curl -LO "http://graphics.cs.williams.edu/data/meshes/$@"

# Head.
head.OBJ: head.zip
	unzip $^ $@
	touch $@
head.obj: head.OBJ
	mv $^ $@
lambertian.jpg: head.zip
	unzip $^ $@
	touch $@
bump-lowRes.png: head.zip
	unzip $^ $@
	touch $@
head.zip:
	curl -LO "http://graphics.cs.williams.edu/data/meshes/$@"

# Cube.
default.png: cube.zip
	unzip $^ $@
	touch $@
cube.zip:
	curl -LO "http://graphics.cs.williams.edu/data/meshes/$@"
