import type { PredictionInput, PredictionResult, PredictionStrategy } from "../core/types";
import { clamp, holtLinearForecast, linearTrend, mean, stddev } from "../core/utils/math";

export class IranDemandPredictionStrategy implements PredictionStrategy {
  async predict(input: PredictionInput): Promise<PredictionResult> {
    const history = input.salesHistoryIrr.filter((v) => Number.isFinite(v) && v > 0);
    if (history.length === 0) {
      throw new Error("salesHistoryIrr must include at least one positive value");
    }

    const inflationRate = Number.isFinite(input.inflationRate) ? (input.inflationRate ?? 0) : 0;
    const importIndexSeries = (input.importIndex ?? []).filter((v) => Number.isFinite(v) && v > 0);
    const importIndex = importIndexSeries.length > 0 ? mean(importIndexSeries) : 1;

    const forecastBase = holtLinearForecast(history, 0.45, 0.25);
    const trendSlope = linearTrend(history);
    const recentAvg = mean(history.slice(Math.max(history.length - 3, 0)));
    const volatility = stddev(history);

    const inflationMultiplier = clamp(1 + inflationRate, 0.5, 3.0);
    const importMultiplier = clamp(importIndex, 0.5, 2.5);

    const adjustedForecast = forecastBase * inflationMultiplier * importMultiplier;
    const boundedForecast = Math.max(0, Math.round(adjustedForecast));

    const confidenceRaw = 1 - clamp(volatility / (recentAvg || 1), 0, 1);
    const lengthBoost = clamp(history.length / 12, 0.5, 1);
    const confidence = clamp(confidenceRaw * lengthBoost, 0.35, 0.95);

    const trend: PredictionResult["trend"] =
      trendSlope > 0 ? "up" : trendSlope < 0 ? "down" : "flat";

    const localizedText = [
      `پیش‌بینی تقاضا (ماه آینده): ${boundedForecast.toLocaleString("fa-IR")} ریال`,
      `روند: ${trend === "up" ? "صعودی" : trend === "down" ? "نزولی" : "ثابت"}`,
      `میانگین اخیر: ${Math.round(recentAvg).toLocaleString("fa-IR")} ریال`,
      `نوسان: ${Math.round(volatility).toLocaleString("fa-IR")} ریال`,
      `اعتماد مدل: ${Math.round(confidence * 100)}٪`,
    ].join("\n");

    return {
      forecastIrr: boundedForecast,
      confidence,
      trend,
      diagnostics: {
        recentAverage: recentAvg,
        volatility,
        dataPoints: history.length,
      },
      localizedText,
    };
  }
}
