const fs = require('node:fs');
const path = require('node:path');

console.log("Running Smoke Test (Build Artifacts)...");

const buildDir = path.resolve(__dirname, '../build/chrome-mv3-prod');

// 1. Check Manifest
const manifestPath = path.join(buildDir, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
    console.error("FAIL: manifest.json missing in build output. Did you build?");
    process.exit(1);
}

try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
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
    'static/background/index.js',
    'assets/js/content.js',
    'assets/js/utils.js',
    'assets/popup/popup.js',
    'assets/options/options.js',
    'assets/popup/popup.css',
    'assets/options/options.css',
    'assets/popup/popup.html',
    'assets/options/options.html',
    'assets/icon.png'
];

let missing = 0;
criticalFiles.forEach(file => {
    if (!fs.existsSync(path.join(buildDir, file))) {
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
