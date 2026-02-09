const MASKED_PAN_REGEX = /^\d{6}\*{6}\d{4}$/;

export function ensureMaskedPan(pan?: string | null) {
  if (!pan) return;
  if (!MASKED_PAN_REGEX.test(pan)) {
    throw new Error('PAN must be masked (6-6-4) before persistence/logging');
  }
}
