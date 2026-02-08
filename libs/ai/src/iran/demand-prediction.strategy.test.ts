import { describe, expect, it } from "vitest";
import { IranDemandPredictionStrategy } from "./demand-prediction.strategy";

describe("IranDemandPredictionStrategy", () => {
  it("produces stable forecast and confidence", async () => {
    const strategy = new IranDemandPredictionStrategy();
    const result = await strategy.predict({
      salesHistoryIrr: [1200000, 1500000, 1800000, 2100000, 2300000],
      importIndex: [0.9, 0.92, 0.95, 0.97, 0.98],
      inflationRate: 0.45,
    });

    expect(result.forecastIrr).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThanOrEqual(0.35);
    expect(result.confidence).toBeLessThanOrEqual(0.95);
    expect(result.trend).toBe("up");
    expect(result.localizedText.length).toBeGreaterThan(10);
  });

  it("rejects invalid input", async () => {
    const strategy = new IranDemandPredictionStrategy();
    await expect(
      strategy.predict({ salesHistoryIrr: [0, -1, NaN] })
    ).rejects.toThrow(/positive/);
  });
});
