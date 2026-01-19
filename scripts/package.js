const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const packageJson = require('../package.json');

const DIST_DIR = path.resolve(__dirname, '../dist');
const ZIP_DIR = path.resolve(__dirname, '../zip');
const ZIP_NAME = `wordspotting-v${packageJson.version}.zip`;

if (!fs.existsSync(DIST_DIR)) {
    console.error('Error: dist directory does not exist. Run build first.');
    process.exit(1);
}

if (!fs.existsSync(ZIP_DIR)) {
    fs.mkdirSync(ZIP_DIR);
}

const output = fs.createWriteStream(path.join(ZIP_DIR, ZIP_NAME));
const archive = archiver('zip', {
    zlib: { level: 9 }
});

output.on('close', function() {
    console.log(`Package created: ${ZIP_NAME} (${archive.pointer()} total bytes)`);
});

archive.on('warning', function(err) {
    if (err.code === 'ENOENT') {
        console.warn(err);
    } else {
        throw err;
    }
});

archive.on('error', function(err) {
    throw err;
});

archive.pipe(output);
archive.directory(DIST_DIR, false);
archive.finalize();
