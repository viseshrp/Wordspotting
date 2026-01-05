#!/usr/bin/env node

// Build a reproducible release zip for the Chrome Web Store.
const fs = require('node:fs');
const path = require('node:path');
const archiver = require('archiver');

process.env.NODE_ENV = 'production';

const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const manifestPath = path.join(root, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

if (manifest.version !== pkg.version) {
  console.error(`Version mismatch: manifest.json (${manifest.version}) != package.json (${pkg.version})`);
  process.exit(1);
}

const buildName = `wordspotting-${pkg.version}`;
const stagingDir = path.join(distDir, buildName);
const zipPath = path.join(distDir, `${buildName}.zip`);

fs.rmSync(stagingDir, { recursive: true, force: true });
fs.rmSync(zipPath, { force: true });
fs.mkdirSync(stagingDir, { recursive: true });

const filesToCopy = [
  { from: 'manifest.json', to: 'manifest.json' },
  { from: 'src', to: 'src' },
  { from: 'PRIVACY.md', to: 'PRIVACY.md', optional: true }
];

for (const entry of filesToCopy) {
  const source = path.join(root, entry.from);
  if (!fs.existsSync(source)) {
    if (entry.optional) continue;
    throw new Error(`Required path missing: ${entry.from}`);
  }
  const destination = path.join(stagingDir, entry.to);
  fs.cpSync(source, destination, { recursive: true });
}

console.log(`Staged extension in ${stagingDir}`);

createZip(stagingDir, zipPath)
  .then(() => {
    console.log(`Package created: ${zipPath}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

function createZip(sourceDir, zipFilePath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}
