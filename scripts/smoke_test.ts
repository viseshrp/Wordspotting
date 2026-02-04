// scripts/smoke_test.ts
import fs from 'node:fs';
import path from 'node:path';

console.log('Running Smoke Test...');

const rootDir = path.resolve(__dirname, '..');

// 1. Check WXT config
const wxtConfigPath = path.join(rootDir, 'wxt.config.ts');
if (!fs.existsSync(wxtConfigPath)) {
  console.error('FAIL: wxt.config.ts missing');
  process.exit(1);
}

console.log('PASS: wxt.config.ts is present');

// 2. Check Critical Files
const criticalFiles = [
  'entrypoints/background.ts',
  'entrypoints/injected.ts',
  'entrypoints/scan-worker.ts',
  'entrypoints/popup/index.html',
  'entrypoints/popup/main.ts',
  'entrypoints/options/index.html',
  'entrypoints/options/main.ts',
  'public/css/index.css',
  'public/assets/ws48.png',
  'entrypoints/shared/utils.ts',
  'entrypoints/shared/settings.ts',
  'entrypoints/shared/core/scanner.ts'
];

let missing = 0;
criticalFiles.forEach((file) => {
  if (!fs.existsSync(path.join(rootDir, file))) {
    console.error(`FAIL: Missing critical file: ${file}`);
    missing += 1;
  }
});

if (missing > 0) {
  console.error(`Smoke Test Failed: ${missing} files missing.`);
  process.exit(1);
}

console.log('PASS: All critical files present.');
console.log('Smoke Test Complete: SUCCESS');
process.exit(0);
