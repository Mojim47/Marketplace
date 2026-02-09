// @vitest-environment node
// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { AISearchService } from "./ai-search.service";

const modelPath = path.join("public", "models", "ai", "all-MiniLM-L6-v2.onnx");
const tokenizerPath = path.join("public", "models", "ai", "tokenizer.json");
const tokenizerConfigPath = path.join("public", "models", "ai", "tokenizer_config.json");

const missingArtifacts = [modelPath, tokenizerPath, tokenizerConfigPath].filter(
  (filePath) => !fs.existsSync(filePath),
);
const describeIfReady = missingArtifacts.length > 0 ? describe.skip : describe;

describeIfReady("AISearchService (embedding ranking)", () => {
  beforeAll(() => {
    process.env.AI_EMBEDDING_ENABLED = "true";
    process.env.AI_EMBEDDING_MODEL_PATH = modelPath;
    process.env.AI_EMBEDDING_TOKENIZER_PATH = tokenizerPath;
    process.env.AI_EMBEDDING_TOKENIZER_CONFIG_PATH = tokenizerConfigPath;
    process.env.AI_EMBEDDING_MAX_LEN = "128";
  });

  it(
    "ranks semantically closer results higher",
    async () => {
      const productSearchService = {
        search: vi.fn().mockResolvedValue({
          hits: [
            { id: "p1", name: "Laptop Pro 14", price: 1200000, images: [] },
            { id: "p2", name: "Banana Premium", price: 80000, images: [] },
          ],
          suggestions: [],
        }),
        getSuggestions: vi.fn().mockResolvedValue([]),
      };

      const service = new AISearchService(productSearchService as any);
      await service.onModuleInit();

      const result = await service.search({ query: "laptop" });
      const top = result.response.metadata.topHits?.[0]?.name;

      expect(top).toBe("Laptop Pro 14");
    },
    { timeout: 30000 },
  );
});
