import { defineConfig } from 'wxt';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import baseConfig from '../../wxt.config';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export default defineConfig({
  ...baseConfig,
  root,
  entrypointsDir: resolve(root, 'tests', 'e2e', 'entrypoints'),
  outDirTemplate: '{{browser}}-mv{{manifestVersion}}-e2e',
});
