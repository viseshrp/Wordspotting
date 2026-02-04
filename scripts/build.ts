#!/usr/bin/env node

// Build a reproducible release zip for the Chrome Web Store using WXT output.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import archiver from 'archiver';

process.env.NODE_ENV = 'production';

const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { version: string };

run('npx', ['wxt', 'build']);

const buildDir = findWxtBuildDir(root);
const manifestPath = path.join(buildDir, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { version: string };

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

fs.cpSync(buildDir, stagingDir, { recursive: true });

const privacyPath = path.join(root, 'PRIVACY.md');
if (fs.existsSync(privacyPath)) {
  fs.copyFileSync(privacyPath, path.join(stagingDir, 'PRIVACY.md'));
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

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { stdio: 'inherit', cwd: root });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function findWxtBuildDir(projectRoot: string) {
  const outputRoot = path.join(projectRoot, '.output');
  if (!fs.existsSync(outputRoot)) {
    throw new Error('WXT output not found. Expected .output directory.');
  }

  const entries = fs.readdirSync(outputRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const chromeEntry = entries.find((name) => name.includes('chrome')) || entries[0];
  if (!chromeEntry) {
    throw new Error('No WXT build output found in .output');
  }

  return path.join(outputRoot, chromeEntry);
}

function createZip(sourceDir: string, zipFilePath: string) {
  return new Promise<void>((resolve, reject) => {
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
