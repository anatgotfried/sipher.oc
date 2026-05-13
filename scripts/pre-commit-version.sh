#!/bin/sh
set -eu

node scripts/bump-version.js >/dev/null
git add package.json
