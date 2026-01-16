// scripts/smoke_test.js
const fs = require("node:fs");
const path = require("node:path");

console.log("Running Smoke Test...");

const rootDir = path.resolve(__dirname, "..");

// 1. Check Manifest
const manifestPath = path.join(rootDir, "manifest.json");
if (!fs.existsSync(manifestPath)) {
    console.error("FAIL: manifest.json missing");
    process.exit(1);
}

try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    if (!manifest.version || !manifest.manifest_version) {
        console.error("FAIL: Invalid manifest structure");
        process.exit(1);
    }
    console.log("PASS: manifest.json is valid");
} catch (_e) {
    console.error("FAIL: manifest.json is not valid JSON");
    process.exit(1);
}

// 2. Check Critical Files
const criticalFiles = [
    "src/js/background.js",
    "src/js/content.js",
    "src/js/utils.js",
    "src/js/popup.js",
    "src/js/options.js",
    "src/css/popup.css",
    "src/css/options.css",
    "src/pages/popup.html",
    "src/pages/options.html",
    "src/assets/ws48.png"
];

let missing = 0;
criticalFiles.forEach((file) => {
    if (!fs.existsSync(path.join(rootDir, file))) {
        console.error(`FAIL: Missing critical file: ${file}`);
        missing++;
    }
});

if (missing > 0) {
    console.error(`Smoke Test Failed: ${missing} files missing.`);
    process.exit(1);
}

console.log("PASS: All critical files present.");
console.log("Smoke Test Complete: SUCCESS");
process.exit(0);
