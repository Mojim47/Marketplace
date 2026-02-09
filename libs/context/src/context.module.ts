// ═══════════════════════════════════════════════════════════════════════════
// Context Module - Multi-Tenant Context Management Module
// ═══════════════════════════════════════════════════════════════════════════

import { Global, Module } from '@nestjs/common';
import { ContextMiddleware } from './context.middleware';
import { ContextService } from './context.service';

@Global()
@Module({
  providers: [ContextService, ContextMiddleware],
  exports: [ContextService, ContextMiddleware],
})
export class ContextModule {}
