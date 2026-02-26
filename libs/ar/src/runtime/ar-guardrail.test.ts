import { describe, expect, it } from 'vitest';
import { evaluateARGuardrail } from './ar-guardrail';

describe('evaluateARGuardrail', () => {
  it('disables overlay when confidence is lower than threshold', () => {
    const result = evaluateARGuardrail({
      arEnabled: true,
      trackingConfidence: 0.42,
      minConfidenceThreshold: 0.75,
      maxAnchorDriftCm: 3,
      latencyBudgetMs: 50,
    });
    expect(result.enabled).toBe(false);
    expect(result.guardReason).toBe('low_confidence');
  });

  it('disables overlay when drift exceeds threshold', () => {
    const result = evaluateARGuardrail({
      arEnabled: true,
      trackingConfidence: 0.9,
      minConfidenceThreshold: 0.75,
      anchorDriftCm: 4,
      maxAnchorDriftCm: 3,
      latencyBudgetMs: 50,
    });
    expect(result.enabled).toBe(false);
    expect(result.guardReason).toBe('drift_exceeded');
  });
});
