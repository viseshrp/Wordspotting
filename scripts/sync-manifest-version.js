#!/usr/bin/env node

// Sync manifest.json version to the package.json version during `npm version`.
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "manifest.json");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

if (manifest.version === pkg.version) {
    console.log(`manifest.json already at ${pkg.version}`);
    process.exit(0);
}

manifest.version = pkg.version;
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Updated manifest.json version to ${pkg.version}`);
