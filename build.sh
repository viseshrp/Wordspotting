#!/bin/bash

set -euo pipefail

cd "$(dirname "$0")"

echo "Building Wordspotting extension..."
npm run build
VERSION=$(node -p "require('./package.json').version")
echo "Build complete: dist/wordspotting-${VERSION}.zip"
