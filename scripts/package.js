// scripts/package.js
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { version } = require('../package.json');

const distPath = path.resolve(__dirname, '../dist');
const zipDir = path.resolve(__dirname, '../zip');
const zipPath = path.join(zipDir, `wordspotting-${version}.zip`);


// Ensure zip directory exists
if (!fs.existsSync(zipDir)) {
    fs.mkdirSync(zipDir);
}

// Create a file to stream archive data to.
const output = fs.createWriteStream(zipPath);
const archive = archiver('zip', {
  zlib: { level: 9 } // Sets the compression level.
});

output.on('close', function() {
  console.log(archive.pointer() + ' total bytes');
  console.log(`Successfully created package at ${zipPath}`);
});

archive.on('error', function(err) {
  throw err;
});

// pipe archive data to the file
archive.pipe(output);

// append files from a sub-directory, putting its contents at the root of archive
archive.directory(distPath, false);

// finalize the archive (ie we are done appending files but streams have to finish yet)
archive.finalize();
