#!/bin/sh
# Assemble the deployable site in _site/: assets, index.html with styles.css
# inlined, and src/ bundled and minified into one game.js. Used by the Pages
# workflow and for local preview:
#
#     tools/build.sh                 # or: tools/build.sh --sourcemap
#     python3 -m http.server -d _site
#
# Extra arguments are passed to esbuild. Needs a standalone `esbuild` binary on
# PATH (no npm); the workflow pins the version it downloads.
set -eu
cd "$(dirname "$0")/.."

command -v esbuild >/dev/null || { echo "build.sh: esbuild not found on PATH" >&2; exit 1; }

rm -rf _site
mkdir -p _site

# Full-resolution source art in assets/originals/ is never loaded; don't ship it.
if [ -d assets ]; then cp -r assets _site/ && rm -rf _site/assets/originals; fi

esbuild src/main.js --bundle --minify --format=esm --target=es2022 \
  --outfile=_site/game.js --log-level=warning "$@"

# Write the page: inline the minified CSS (saves a render-blocking request) and
# point the script tag at the bundle instead of the source modules.
esbuild styles.css --minify --log-level=warning > _site/styles.min.css
python3 - <<'EOF'
import sys
html = open('index.html').read()
css = open('_site/styles.min.css').read().strip()
swaps = [
    ('<link rel="stylesheet" href="./styles.css" />', '<style>' + css + '</style>'),
    ('"./src/main.js"', '"./game.js"'),
]
for old, new in swaps:
    if html.count(old) != 1:
        sys.exit(f'build.sh: expected exactly one {old} in index.html')
    html = html.replace(old, new)
open('_site/index.html', 'w').write(html)
EOF
rm _site/styles.min.css

ls -l _site/game.js | awk '{ printf "game.js: %d bytes\n", $5 }'
