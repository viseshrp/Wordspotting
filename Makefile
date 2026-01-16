.PHONY: all install build bundle dev lint test smoke package format

# Default target: install, lint, test, and build
all: install lint test build

# Install dependencies for a clean build environment
install:
	npm ci

# Build the extension for production using Webpack
build:
	npm run build

# Alias for the build target
bundle: build

# Run webpack in watch mode for development
dev:
	npm run dev

# Run all linters
lint:
	npm run lint
	npm run lint:webext
	npm run biome

# Run unit tests in band, as in CI
test:
	npm test -- --runInBand

# Run smoke tests (both simple and e2e)
smoke:
	npx playwright install chromium
	npm run smoke
	npm run smoke:e2e

# Create the distributable package and check its size
package: build
	npm run package
	npm run check-size

# Format code using Prettier
format:
	npm run format
