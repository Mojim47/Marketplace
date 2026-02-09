export interface PredictionInput {
  salesHistoryIrr: number[];
  jalaliDates?: string[];
  importIndex?: number[];
  inflationRate?: number;
}

export interface PredictionResult {
  forecastIrr: number;
  confidence: number;
  trend: 'up' | 'down' | 'flat';
  diagnostics: {
    recentAverage: number;
    volatility: number;
    dataPoints: number;
  };
  localizedText: string;
}

export interface PredictionStrategy {
  predict(input: PredictionInput): Promise<PredictionResult>;
}
