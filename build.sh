#!/bin/bash
# build.sh — package WGT and optionally install to TV
# Usage: ./build.sh [TV_IP] [TIZEN_PROFILE]
set -e

SDB="${SDB:-$HOME/tizen-studio/tools/sdb}"
TIZEN="${TIZEN:-$HOME/tizen-studio/tools/ide/bin/tizen}"
TV_IP="${1:-}"
PROFILE="${2:-TestProfile}"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)/src"
OUT="Sonarrzen.wgt"

if [[ ! -x "$TIZEN" ]]; then
  echo "Tizen CLI not found at $TIZEN — install Tizen Studio or set TIZEN env var." >&2
  exit 1
fi

echo "→ Cleaning old WGT..."
rm -f "$SRC_DIR"/*.wgt "$OUT"

echo "→ Packaging WGT (profile: $PROFILE)..."
"$TIZEN" package --type wgt --sign "$PROFILE" -- "$SRC_DIR"

WGT=$(ls "$SRC_DIR"/*.wgt 2>/dev/null | head -1)
if [[ -z "$WGT" ]]; then
  echo "Build failed: no .wgt produced" >&2
  exit 1
fi
mv "$WGT" "$OUT"
echo "✓ Built: $OUT ($(du -h "$OUT" | cut -f1))"

if [[ -z "$TV_IP" ]]; then
  echo "(no TV IP given — skipping install)"
  exit 0
fi

echo "→ Connecting to TV at $TV_IP..."
"$SDB" connect "$TV_IP" || true
sleep 2

DEVICE=$("$SDB" devices | awk -v ip="$TV_IP" 'index($0,ip){print $1; exit}')
if [[ -z "$DEVICE" ]]; then
  DEVICE="$TV_IP:26101"
fi
echo "→ Installing to $DEVICE..."
"$TIZEN" install -n "$OUT" -t "$DEVICE"
echo "✓ Installed."
