#!/usr/bin/env node

// Lint the extension using web-ext while tolerating MV3-only Chrome fields.
const path = require('node:path');
const webExt = require('web-ext').default;

async function main() {
  const { errors, warnings, notices } = await webExt.cmd.lint(
    {
      sourceDir: path.resolve(__dirname, '..'),
      artifactsDir: path.resolve(__dirname, '..', 'web-ext-artifacts'),
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

  const allowed = errors.filter((err) =>
    (err.code === 'MANIFEST_FIELD_UNSUPPORTED' && err.message.includes('service_worker')) ||
    (err.code === 'EXTENSION_ID_REQUIRED' && err.message.includes('Manifest Version 3'))
  );
  const fatal = errors.filter((err) => !allowed.includes(err));

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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
