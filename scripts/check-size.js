// scripts/check-size.js
const fs = require("node:fs");
const path = require("node:path");
const { version } = require("../package.json");

const zipDir = path.resolve(__dirname, "../zip");
const zipPath = path.join(zipDir, `wordspotting-${version}.zip`);
const max_kb = 1024;

if (!fs.existsSync(zipPath)) {
    console.error(`Error: Package not found at ${zipPath}. Run 'npm run package' first.`);
    process.exit(1);
}

const stats = fs.statSync(zipPath);
const size_kb = Math.round(stats.size / 1024);

console.log(`Package size: ${size_kb} KB (limit ${max_kb} KB)`);

if (size_kb > max_kb) {
    console.error("Package exceeds size budget.");
    process.exit(1);
}

console.log("Package size is within budget.");
