import fs from 'node:fs';
import path from 'node:path';
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { OnnxEmbedder } from './onnx-embedder';

const modelPath = path.join('public', 'models', 'ai', 'all-MiniLM-L6-v2.onnx');
const tokenizerPath = path.join('public', 'models', 'ai', 'tokenizer.json');
const tokenizerConfigPath = path.join('public', 'models', 'ai', 'tokenizer_config.json');

const missingArtifacts = [modelPath, tokenizerPath, tokenizerConfigPath].filter(
  (filePath) => !fs.existsSync(filePath)
);
const describeIfReady = missingArtifacts.length > 0 ? describe.skip : describe;

describeIfReady('OnnxEmbedder', () => {
  it('loads model and produces embedding', async () => {
    const embedder = new OnnxEmbedder({
      modelPath,
      tokenizerPath,
      tokenizerConfigPath,
      maxLength: 64,
    });

    await embedder.ready();
    const vector = await embedder.embed('سلام دنیا');
    expect(vector.length).toBeGreaterThan(0);
    expect(vector.every((v) => Number.isFinite(v))).toBe(true);
  });
});
