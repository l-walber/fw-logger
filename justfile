set shell := ["powershell.exe", "-NoProfile", "-Command"]

install:
	npm install

dev:
	npm run dev

build: build-standalone build-external

build-standalone:
	npx vite build --outDir dist/standalone
	$env:QL_PAGE = "diagnostics"; npx vite build --outDir dist/standalone

build-external:
	$env:QL_EXTERNAL_CONFIG = "1"; npx vite build --outDir dist/external
	$env:QL_EXTERNAL_CONFIG = "1"; $env:QL_PAGE = "diagnostics"; npx vite build --outDir dist/external

clean:
	if (Test-Path "dist") { Remove-Item -Recurse "dist" }
	if (Test-Path "node_modules") { Remove-Item -Recurse "node_modules" }

rebuild: clean install build

test:
	npm run test
