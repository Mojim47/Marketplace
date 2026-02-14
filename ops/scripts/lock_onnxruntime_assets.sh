#!/usr/bin/env bash
set -euo pipefail

ASSETS_DIR="ops/assets/ai"
ONNX_DIR="$ASSETS_DIR/onnxruntime"
MODELS_DIR="$ASSETS_DIR/models"

mkdir -p "$ONNX_DIR" "$MODELS_DIR"

echo "[+] Downloading onnxruntime binaries (pin version manually here)"
# curl -L -o "$ONNX_DIR/onnxruntime.tgz" "https://<official-source>/onnxruntime-<version>.tgz"

# Example extract (uncomment and adjust):
# tar -xzf "$ONNX_DIR/onnxruntime.tgz" -C "$ONNX_DIR"

echo "[+] Downloading models (pin exact versions)"
# curl -L -o "$MODELS_DIR/model.onnx" "https://<official-source>/model-<sha>.onnx"

# Optional: download tokenizer
# curl -L -o "$MODELS_DIR/tokenizer.json" "https://<official-source>/tokenizer-<sha>.json"
# curl -L -o "$MODELS_DIR/tokenizer_config.json" "https://<official-source>/tokenizer_config-<sha>.json"

echo "[+] Generating checksums"
(cd "$ASSETS_DIR" && sha256sum onnxruntime/* models/* > CHECKSUMS.sha256)

echo "[✓] Assets locked offline. Update tests to read from ops/assets/ai and verify CHECKSUMS."