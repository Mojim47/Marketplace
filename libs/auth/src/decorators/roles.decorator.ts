// ═══════════════════════════════════════════════════════════════════════════
// Roles Decorator - Require Specific User Roles
// ═══════════════════════════════════════════════════════════════════════════

import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../types';

export const REQUIRED_ROLES_KEY = 'requiredRoles';

/**
 * Decorator to require specific roles for an endpoint
 * @example
 * @RequireRoles('ADMIN', 'SUPER_ADMIN')
 * @Get('admin/users')
 * getUsers() {}
 */
export const RequireRoles = (...roles: UserRole[]) => SetMetadata(REQUIRED_ROLES_KEY, roles);
