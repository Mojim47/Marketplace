import { describe, it, expect } from 'vitest';
import { ensureMaskedPan } from './pan.guard';

describe('PAN guard', () => {
  it('accepts masked 6-6-4 PAN', () => {
    expect(() => ensureMaskedPan('123456******9876')).not.toThrow();
  });

  it('rejects unmasked PAN', () => {
    expect(() => ensureMaskedPan('1234567890123456')).toThrow(/masked/);
  });
});
