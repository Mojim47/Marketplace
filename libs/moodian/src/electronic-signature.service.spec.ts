import { describe, it, expect } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { ElectronicSignatureService } from './electronic-signature.service';

describe('ElectronicSignatureService fail-fast', () => {
  it('throws when moodian v2 enabled and keys missing', () => {
    const cfg = new ConfigService({ FEATURE_MOODIAN_V2: 'true' });
    expect(() => new ElectronicSignatureService(cfg)).toThrowError(
      /Moodian v2 enabled but MOODIAN_PRIVATE_KEY or MOODIAN_PUBLIC_KEY is missing/,
    );
  });
});
