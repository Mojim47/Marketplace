// ═══════════════════════════════════════════════════════════════════════════
// Scopes Decorator - Require Specific Token Scopes
// ═══════════════════════════════════════════════════════════════════════════

import { SetMetadata } from '@nestjs/common';
import type { TokenScope } from '../types';

export const REQUIRED_SCOPES_KEY = 'requiredScopes';

/**
 * Decorator to require specific scopes for an endpoint
 * @example
 * @RequireScopes('user:read', 'order:create')
 * @Get('orders')
 * getOrders() {}
 */
export const RequireScopes = (...scopes: TokenScope[]) => SetMetadata(REQUIRED_SCOPES_KEY, scopes);
