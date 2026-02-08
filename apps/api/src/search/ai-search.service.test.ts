import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AISearchService } from "./ai-search.service";

const makeProductSearchService = () => ({
  search: vi.fn().mockResolvedValue({
    hits: [
      { id: "p1", name: "Laptop Pro", price: 1200000, images: [] },
      { id: "p2", name: "Laptop Air", price: 980000, images: [] },
    ],
    suggestions: ["لپ‌تاپ", "لپ‌تاپ گیمینگ"],
  }),
  getSuggestions: vi.fn().mockResolvedValue(["لپ‌تاپ", "کیف لپ‌تاپ"]),
});

describe("AISearchService", () => {
  const prev = process.env.AI_EMBEDDING_ENABLED;
  beforeAll(() => {
    process.env.AI_EMBEDDING_ENABLED = "false";
  });
  afterAll(() => {
    if (prev === undefined) {
      delete process.env.AI_EMBEDDING_ENABLED;
    } else {
      process.env.AI_EMBEDDING_ENABLED = prev;
    }
  });

  it("returns cached response on repeated queries", async () => {
    const searchService = makeProductSearchService();
    const service = new AISearchService(searchService as any);
    await service.onModuleInit();

    const first = await service.search({ query: "laptop" });
    const second = await service.search({ query: "laptop" });

    expect(first.fromCache).toBe(false);
    expect(second.fromCache).toBe(true);
    expect(second.similarity).toBeGreaterThanOrEqual(0.82);
    expect(searchService.search).toHaveBeenCalledTimes(1);
  });

  it("streams predictions from product suggestions", async () => {
    const searchService = makeProductSearchService();
    const service = new AISearchService(searchService as any);
    await service.onModuleInit();

    const start = await service.startPrediction("lap", "s1");
    expect(start.predictions.length).toBeGreaterThan(0);
    expect(start.confidence).toBeGreaterThan(0);

    await service.updatePrediction("s1", {
      sessionId: "s1",
      content: "top",
      isComplete: false,
      timestamp: Date.now(),
    });

    const state = await service.getPredictionState("s1");
    expect(state?.predictions.length).toBeGreaterThan(0);
    expect(searchService.getSuggestions).toHaveBeenCalled();
  });

  it("calculates similarity and exposes cache stats", async () => {
    const searchService = makeProductSearchService();
    const service = new AISearchService(searchService as any);
    await service.onModuleInit();

    const similarity = await service.calculateSimilarity("laptop pro", "laptop");
    expect(similarity).toBeGreaterThan(0);

    await service.search({ query: "laptop" });
    const stats = await service.getCacheStats();
    expect(stats?.entries).toBeGreaterThan(0);
  });
});
