// @vitest-environment node
import { describe, expect, it } from "vitest";
import path from "node:path";
import { OnnxEmbedder } from "./onnx-embedder";

describe("OnnxEmbedder", () => {
  it("loads model and produces embedding", async () => {
    const embedder = new OnnxEmbedder({
      modelPath: path.join("public", "models", "ai", "all-MiniLM-L6-v2.onnx"),
      tokenizerPath: path.join("public", "models", "ai", "tokenizer.json"),
      tokenizerConfigPath: path.join("public", "models", "ai", "tokenizer_config.json"),
      maxLength: 64,
    });

    await embedder.ready();
    const vector = await embedder.embed("سلام دنیا");
    expect(vector.length).toBeGreaterThan(0);
    expect(vector.every((v) => Number.isFinite(v))).toBe(true);
  });
});
