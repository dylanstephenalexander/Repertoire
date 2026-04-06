#!/usr/bin/env bash
# Download all 9 Maia weight files into backend/app/data/maia/
# Usage: bash scripts/fetch_maia.sh

set -e

DEST="$(dirname "$0")/../backend/app/data/maia"
mkdir -p "$DEST"

for elo in 1100 1200 1300 1400 1500 1600 1700 1800 1900; do
  FILE="$DEST/maia-${elo}.pb.gz"
  if [ -f "$FILE" ]; then
    echo "maia-${elo}.pb.gz already exists, skipping"
  else
    echo "Downloading maia-${elo}.pb.gz..."
    curl -L -o "$FILE" \
      "https://github.com/CSSLab/maia-chess/releases/download/v1.0/maia-${elo}.pb.gz"
  fi
done

echo "Done. All Maia models are in $DEST"
