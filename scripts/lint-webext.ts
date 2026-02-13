#!/usr/bin/env node

// Lint the extension using web-ext while tolerating MV3-only Chrome fields.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import webExt from 'web-ext';

const root = path.resolve(__dirname, '..');

const outputRoot = path.join(root, '.output');
const createdOutput = ensureBuildOutput(outputRoot);
const sourceDir = findWxtBuildDir(root);

async function main() {
  const { errors, warnings, notices } = await webExt.cmd.lint(
    {
      sourceDir,
      artifactsDir: path.resolve(root, 'web-ext-artifacts'),
      ignoreFiles: [
        'node_modules/**',
        'dist/**',
        'tests/**',
        'verification/**',
        '.github/**',
        'coverage/**',
        'npm-debug.log*',
        'build.sh',
        'test.sh'
      ]
    },
    { shouldExitProgram: false }
  );

  const allowed = errors.filter((err: { code: string; message: string }) =>
    (err.code === 'MANIFEST_FIELD_UNSUPPORTED' && err.message.includes('service_worker')) ||
    (err.code === 'EXTENSION_ID_REQUIRED' && err.message.includes('Manifest Version 3'))
  );
  const fatal = errors.filter((err: { code: string; message: string }) => !allowed.includes(err));

  if (allowed.length) {
    console.log('Ignoring MV3-specific Chrome fields flagged by web-ext:');
    for (const err of allowed) {
      console.log(`- [${err.code}] ${err.message}`);
    }
  }

  for (const warn of warnings) {
    console.warn(`[warning] ${warn.message || warn.code}`);
  }
  for (const note of notices) {
    console.log(`[notice] ${note.message || note.code}`);
  }

  if (fatal.length) {
    console.error(`web-ext lint failed with ${fatal.length} error(s):`);
    for (const err of fatal) {
      console.error(`- [${err.code}] ${err.message}`);
    }
    process.exit(1);
  }

  console.log('web-ext lint completed with no blocking errors.');
}

main()
  .then(() => cleanup())
  .catch((err) => {
    console.error(err);
    cleanup();
    process.exit(1);
  });

function ensureBuildOutput(target: string) {
  if (fs.existsSync(target)) return false;
  run('npx', ['wxt', 'build']);
  return true;
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

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { stdio: 'inherit', cwd: root });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function cleanup() {
  if (!createdOutput) return;
  try {
    fs.rmSync(outputRoot, { recursive: true, force: true });
  } catch (err) {
    console.warn('Failed to clean WXT output:', err);
  }
}
