#!/bin/bash

# Build script for Wordspotting

echo "Building Wordspotting Extension..."

# Remove old zip
rm -f wordspotting.zip

# Create zip, excluding dev files
zip -r wordspotting.zip . \
    -x "*.git*" \
    -x "tests/*" \
    -x "verification/*" \
    -x ".github/*" \
    -x "node_modules/*" \
    -x "coverage/*" \
    -x ".gitignore" \
    -x "build.sh" \
    -x "test.sh" \
    -x "perf_test.js" \
    -x "*.DS_Store"

echo "Build complete: wordspotting.zip"
