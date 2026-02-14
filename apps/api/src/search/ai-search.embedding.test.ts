import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { AISearchService } from './ai-search.service';

const ASSETS_ROOT = path.join('ops', 'assets', 'ai');
const CHECKSUM_FILE = path.join(ASSETS_ROOT, 'CHECKSUMS.sha256');
const checksums = new Map(
  fs
    .readFileSync(CHECKSUM_FILE, 'utf-8')
    .trim()
    .split('\n')
    .map((line) => {
      const [hash, file] = line.trim().split(/\s+/, 2);
      return [file, hash];
    })
);
const hashOf = (relPath: string) => {
  const abs = path.join(ASSETS_ROOT, relPath);
  const h = crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex').toUpperCase();
  return h;
};
['onnxruntime/VERSION.txt', 'models/model.onnx'].forEach((rel) => {
  expect(hashOf(rel)).toBe(checksums.get(rel));
});

vi.mock('../../../../libs/ai/src/embeddings/onnx-embedder', () => ({
  OnnxEmbedder: class {
    async ready() {}
    async embed(_q: string) {
      return new Float32Array([0.9, 0.1]);
    }
  },
}));

describe('AISearchService (embedding ranking, offline CI)', () => {
  beforeAll(() => {
    process.env.AI_EMBEDDING_ENABLED = 'true';
    process.env.AI_EMBEDDING_MODEL_PATH = path.join(ASSETS_ROOT, 'models', 'model.onnx');
    process.env.AI_EMBEDDING_TOKENIZER_PATH = path.join(ASSETS_ROOT, 'models', 'tokenizer.json');
    process.env.AI_EMBEDDING_TOKENIZER_CONFIG_PATH = path.join(
      ASSETS_ROOT,
      'models',
      'tokenizer_config.json'
    );
    process.env.AI_EMBEDDING_MAX_LEN = '128';
  });

  it(
    'ranks semantically closer results higher',
    async () => {
      const productSearchService = {
        search: vi.fn().mockResolvedValue({
          hits: [
            { id: 'p1', name: 'Laptop Pro 14', price: 1200000, images: [] },
            { id: 'p2', name: 'Banana Premium', price: 80000, images: [] },
          ],
          suggestions: [],
        }),
        getSuggestions: vi.fn().mockResolvedValue([]),
      };

      const service = new AISearchService(productSearchService as any);
      await service.onModuleInit();

      const result = await service.search({ query: 'laptop' });
      const top = result.response.metadata.topHits?.[0]?.name;

      expect(top).toBe('Laptop Pro 14');
    },
    { timeout: 30000 }
  );
});
