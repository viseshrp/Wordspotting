VERSION := $(shell node -p "require('./package.json').version")
BUILD_DIR := build/chrome-mv3-prod
DIST_DIR := dist
ZIP_NAME := wordspotting-$(VERSION).zip

.PHONY: all build package clean test lint

all: package

clean:
	rm -rf build dist

build:
	npm run build
	# Copy assets manually
	cp -r assets $(BUILD_DIR)/
	# Patch manifest
	python3 scripts/patch_manifest.py $(BUILD_DIR)/manifest.json

package: build
	mkdir -p $(DIST_DIR)
	cd $(BUILD_DIR) && zip -r ../../$(DIST_DIR)/$(ZIP_NAME) .
	@echo "Package created: $(DIST_DIR)/$(ZIP_NAME)"
	# Check size (1MB limit)
	@du -k $(DIST_DIR)/$(ZIP_NAME) | awk '{ if ($$1 > 1024) { print "Error: Zip size " $$1 "KB exceeds 1024KB limit"; exit 1 } else { print "Size check passed: " $$1 "KB" } }'

test:
	npm test

lint:
	# Placeholder
	echo "Linting..."
