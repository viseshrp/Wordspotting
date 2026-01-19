.PHONY: install build dev test lint package clean

install:
	npm install

build:
	npm run build

dev:
	npm run dev

test:
	npm run test

lint:
	npm run lint
	npm run lint:webext

package: build
	npm run package
	npm run check-size

clean:
	rm -rf dist zip coverage
