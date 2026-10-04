#!/usr/bin/env bash
# Generates the PWA icon set with ffmpeg, so the icons are reproducible rather than binary blobs
# with no provenance. Navy is BYU's #002E5D; the sub-label uses their sky blue #AFD6FE.
#
# Two variants matter:
#   - "any"      fills the square, which is what Chrome shows in the tab and the install dialog.
#   - "maskable" keeps all content inside the middle ~80%, because Android crops maskable icons to
#     a circle/squircle. Using the "any" icon as maskable is the classic PWA bug where the logo
#     gets its edges shaved off.
#
# Usage: bash scripts/make-icons.sh   (requires ffmpeg and a bold system font)
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p public/icons

# ffmpeg parses ':' as its filter option separator, so a Windows drive letter cannot appear in the
# fontfile value. FONT is the path ffmpeg sees (drive-relative on Windows); FONT_CHECK is the same
# file in a form the shell can stat.
FONT="${FONT:-/Windows/Fonts/arialbd.ttf}"
FONT_CHECK="${FONT_CHECK:-/c/Windows/Fonts/arialbd.ttf}"
[ -f "$FONT_CHECK" ] || [ -f "$FONT" ] || {
  echo "Font not found: $FONT_CHECK (set FONT and FONT_CHECK to a bold .ttf)"
  exit 1
}

NAVY="0x002E5D"
SKY="0xAFD6FE"

# $1 size, $2 output, $3 BYU font size, $4 EVENTS font size, $5 vertical offset
render() {
  ffmpeg -v error -f lavfi -i "color=c=${NAVY}:s=$1x$1" \
    -vf "drawtext=fontfile=${FONT}:text='BYU':fontcolor=white:fontsize=$3:x=(w-text_w)/2:y=(h-text_h)/2-$5,\
drawtext=fontfile=${FONT}:text='EVENTS':fontcolor=${SKY}:fontsize=$4:x=(w-text_w)/2:y=(h-text_h)/2+$5" \
    -frames:v 1 -y "$2"
  echo "  wrote $2"
}

# Full-bleed icons.
render 512 public/icons/icon-512.png 150 54 70
render 192 public/icons/icon-192.png 56 20 26

# Maskable: ~70% of the canvas so Android's circular crop never clips the wordmark.
render 512 public/icons/maskable-512.png 108 38 50
render 192 public/icons/maskable-192.png 40 14 19

# iOS home-screen icon. Safari ignores the manifest for this and reads <link rel="apple-touch-icon">.
render 180 public/icons/apple-touch-icon.png 52 19 24

echo "Done."
