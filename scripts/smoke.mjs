import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const requiredFiles = [
  'package.json',
  'wxt.config.ts',
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
  'entrypoints/shared/core/scanner.ts',
];

const missing = requiredFiles.filter((file) => !existsSync(resolve(process.cwd(), file)));
if (missing.length > 0) {
  console.error('Smoke check failed. Missing files:');
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

console.log('Smoke check passed.');
