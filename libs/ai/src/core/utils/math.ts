export function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

export function variance(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }
  const avg = mean(values);
  const sum = values.reduce((acc, v) => acc + (v - avg) ** 2, 0);
  return sum / (values.length - 1);
}

export function stddev(values: number[]): number {
  return Math.sqrt(variance(values));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function holtLinearForecast(values: number[], alpha = 0.4, beta = 0.2): number {
  if (values.length === 0) {
    return 0;
  }
  if (values.length === 1) {
    return values[0];
  }

  let level = values[0];
  let trend = values[1] - values[0];

  for (let i = 1; i < values.length; i += 1) {
    const value = values[i];
    const prevLevel = level;
    level = alpha * value + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }

  return level + trend;
}

export function linearTrend(values: number[]): number {
  const n = values.length;
  if (n < 2) {
    return 0;
  }
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i += 1) {
    const x = i + 1;
    const y = values[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) {
    return 0;
  }
  return (n * sumXY - sumX * sumY) / denominator;
}
