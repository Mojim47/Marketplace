#!/usr/bin/env bash
set -euo pipefail

# Simple grep gate to avoid PAN leaks in logs/configs
if rg --line-number --passthru "cardPan|card_pan|pan=" apps | grep -v "maskPan" | grep -v "MASKED"; then
  echo "❌ Potential PAN leak detected. Ensure PAN is masked or remove logging."
  exit 1
fi

echo "✅ PAN leak check passed."
