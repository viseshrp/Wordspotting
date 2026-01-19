const fs = require('fs');
const path = require('path');
const packageJson = require('../package.json');

const ZIP_DIR = path.resolve(__dirname, '../zip');
const ZIP_NAME = `wordspotting-v${packageJson.version}.zip`;
const ZIP_PATH = path.join(ZIP_DIR, ZIP_NAME);
const MAX_SIZE_BYTES = 1024 * 1024; // 1MB

if (!fs.existsSync(ZIP_PATH)) {
    console.error(`Error: Package not found at ${ZIP_PATH}`);
    process.exit(1);
}

const stats = fs.statSync(ZIP_PATH);
const size = stats.size;

console.log(`Package size: ${(size / 1024).toFixed(2)} KB`);

if (size > MAX_SIZE_BYTES) {
    console.error(`Error: Package size exceeds limit of ${MAX_SIZE_BYTES} bytes.`);
    process.exit(1);
}

console.log('Size check passed.');
