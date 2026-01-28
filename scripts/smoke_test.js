// scripts/smoke_test.js
const fs = require('node:fs');
const path = require('node:path');

console.log("Running Smoke Test...");

const rootDir = path.resolve(__dirname, '..');

// 1. Check Manifest (Check WXT Config exists as source of truth)
const configPath = path.join(rootDir, 'wxt.config.ts');
if (!fs.existsSync(configPath)) {
    console.error("FAIL: wxt.config.ts missing");
    process.exit(1);
}
console.log("PASS: wxt.config.ts present");

// 2. Check Critical Source Files (New Structure)
const criticalFiles = [
    'entrypoints/background.ts',
    'entrypoints/injected.ts',
    'utils/utils.ts',
    'entrypoints/popup/main.ts',
    'entrypoints/options/main.ts',
    'entrypoints/popup/popup.css',
    'entrypoints/options/options.css',
    'entrypoints/popup/index.html',
    'entrypoints/options/index.html',
    'public/assets/ws48.png'
];

let missing = 0;
criticalFiles.forEach(file => {
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
