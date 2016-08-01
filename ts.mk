# TypeScript/JavaScript/Node/npm utilities.


# Convenient variables/macros.

# A macro to describe a dependency on an npm package.
npmdep = node_modules/$(1)/package.json

# And one for executables installed by npm.
npmbin = $(shell npm bin)/$(1)


# Install tools and dependencies from npm. We assume the dependency is listed
# in the project's package.json.

node_modules/%/package.json: package.json
	npm install
	touch $@


# Specific TypeScript-related tools.

TSC := $(call npmbin,tsc)
$(TSC): $(call npmdep,typescript)

TYPINGS_CMD := $(call npmbin,typings)
$(TYPINGS_CMD): $(call npmdep,typings)


# Fetch TypeScript typing headers.

TYPINGS := typings/index.d.ts
$(TYPINGS): typings.json $(TYPINGS_CMD)
	$(TYPINGS_CMD) install
	touch $@
