// ═══════════════════════════════════════════════════════════════════════════
// Validation Module - Unified Validation with Security
// ═══════════════════════════════════════════════════════════════════════════

import { Module, Global } from '@nestjs/common';

// Services
import { ValidationService } from './validation.service';

@Global()
@Module({
  providers: [ValidationService],
  exports: [ValidationService],
})
export class ValidationModule {}