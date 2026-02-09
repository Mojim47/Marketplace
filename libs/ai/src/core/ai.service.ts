import type { PredictionInput, PredictionResult, PredictionStrategy } from './types';

export class AIService {
  constructor(private readonly strategy: PredictionStrategy) {}

  async predict(input: PredictionInput): Promise<PredictionResult> {
    if (!input.salesHistoryIrr || input.salesHistoryIrr.length === 0) {
      throw new Error('salesHistoryIrr is required for prediction');
    }
    return this.strategy.predict(input);
  }
}
