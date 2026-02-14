import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { OnnxEmbedder } from "./onnx-embedder";

const ASSETS_ROOT = path.join("ops", "assets", "ai");
const CHECKSUM_FILE = path.join(ASSETS_ROOT, "CHECKSUMS.sha256");
const modelPath = path.join(ASSETS_ROOT, "models", "model.onnx");
const tokenizerPath = path.join(ASSETS_ROOT, "models", "tokenizer.json");
const tokenizerConfigPath = path.join(ASSETS_ROOT, "models", "tokenizer_config.json");

const checksums = new Map(
  fs
    .readFileSync(CHECKSUM_FILE, "utf-8")
    .trim()
    .split("\n")
    .map((line) => {
      const [hash, file] = line.trim().split(/\s+/, 2);
      return [file, hash];
    })
);

const hashOf = (relPath: string) => {
  const abs = path.join(ASSETS_ROOT, relPath);
  const h = crypto.createHash("sha256").update(fs.readFileSync(abs)).digest("hex").toUpperCase();
  return h;
};

["onnxruntime/VERSION.txt", "models/model.onnx"].forEach((rel) => {
  expect(hashOf(rel)).toBe(checksums.get(rel));
});

vi.mock("onnxruntime-node", () => {
  class Tensor {
    constructor(public type: string, public data: any, public dims: number[]) {}
  }
  class InferenceSession {
    static create = vi.fn().mockResolvedValue(new InferenceSession());
    async run() {
      return { pooler_output: new Tensor("float32", new Float32Array([0.1, 0.2, 0.3]), [1, 3]) };
    }
  }
  return { Tensor, InferenceSession };
});

vi.mock("@huggingface/tokenizers", () => {
  const encode = (_text: string) => ({
    ids: [1, 2, 3, 4],
    attention_mask: [1, 1, 1, 1],
    attentionMask: [1, 1, 1, 1],
  });
  class Tokenizer {
    encode = encode;
    setTruncation() {}
    setPadding() {}
    enableTruncation() {}
    enablePadding() {}
  }
  return { Tokenizer };
});

describe("ONNX embedder (offline, CI-safe)", () => {
  it("loads mock session and produces embedding vector", async () => {
    const embedder = new OnnxEmbedder({
      modelPath,
      tokenizerPath,
      tokenizerConfigPath,
      maxLength: 64,
    });

    await embedder.ready();
    const vector = await embedder.embed("سلام دنیا");
    expect(vector.length).toBeGreaterThan(0);
    expect(vector.every((v) => Number.isFinite(v))).toBe(true);
  });
});