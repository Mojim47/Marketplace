import { describe, expect, it } from 'vitest';
import { AIService } from './ai.service';
import type { PredictionInput, PredictionResult, PredictionStrategy } from './types';

class DummyStrategy implements PredictionStrategy {
  async predict(_input: PredictionInput): Promise<PredictionResult> {
    return {
      forecastIrr: 1000,
      confidence: 0.9,
      trend: 'up',
      diagnostics: { recentAverage: 900, volatility: 100, dataPoints: 3 },
      localizedText: 'ok',
    };
  }
}

describe('AIService', () => {
  it('throws on empty history', async () => {
    const service = new AIService(new DummyStrategy());
    await expect(service.predict({ salesHistoryIrr: [] })).rejects.toThrow(/salesHistoryIrr/i);
  });

  it('delegates to strategy', async () => {
    const service = new AIService(new DummyStrategy());
    const result = await service.predict({ salesHistoryIrr: [1, 2, 3] });
    expect(result.forecastIrr).toBe(1000);
    expect(result.confidence).toBeCloseTo(0.9);
  });
});
