#!/usr/bin/env node

const input = process.argv[2] ?? process.env.GITHUB_REF_NAME;

if (!input) {
  console.error(
    'Missing tag input. Pass a tag argument (e.g., v1.2.3) or set GITHUB_REF_NAME.',
  );
  process.exit(1);
}

const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(input);

if (!match) {
  console.error(
    `Invalid release tag '${input}'. Expected format: v<major>.<minor>.<patch> (example: v1.2.3).`,
  );
  process.exit(1);
}

const [, major, minor, patch] = match;
const normalizedVersion = `${major}.${minor}.${patch}`;

process.stdout.write(`${normalizedVersion}\n`);
