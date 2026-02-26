export interface ARGuardrailInput {
  arEnabled: boolean;
  trackingConfidence?: number;
  minConfidenceThreshold: number;
  anchorDriftCm?: number;
  maxAnchorDriftCm: number;
  pipelineLatencyMs?: number;
  latencyBudgetMs: number;
  cameraCalibrated?: boolean;
  visualInertialAligned?: boolean;
}

export interface ARGuardrailResult {
  enabled: boolean;
  guardReason:
    | 'none'
    | 'low_confidence'
    | 'drift_exceeded'
    | 'latency_budget_exceeded'
    | 'calibration_missing'
    | 'sensor_fusion_invalid';
}

export function evaluateARGuardrail(input: ARGuardrailInput): ARGuardrailResult {
  if (!input.arEnabled) {
    return { enabled: false, guardReason: 'none' };
  }
  if (input.cameraCalibrated === false) {
    return { enabled: false, guardReason: 'calibration_missing' };
  }
  if (input.visualInertialAligned === false) {
    return { enabled: false, guardReason: 'sensor_fusion_invalid' };
  }
  if (
    Number.isFinite(input.trackingConfidence) &&
    (input.trackingConfidence as number) < input.minConfidenceThreshold
  ) {
    return { enabled: false, guardReason: 'low_confidence' };
  }
  if (
    Number.isFinite(input.anchorDriftCm) &&
    (input.anchorDriftCm as number) > input.maxAnchorDriftCm
  ) {
    return { enabled: false, guardReason: 'drift_exceeded' };
  }
  if (
    Number.isFinite(input.pipelineLatencyMs) &&
    (input.pipelineLatencyMs as number) > input.latencyBudgetMs
  ) {
    return { enabled: false, guardReason: 'latency_budget_exceeded' };
  }
  return { enabled: true, guardReason: 'none' };
}
