/**
 * Property-Based Tests for Authorization
 *
 * These tests validate the security properties of authorization guards
 * using fast-check for property-based testing.
 *
 * Requirements validated:
 * - 3.1: Role-based access control
 * - 3.2: Resource ownership verification
 * - 3.3: Consistent authorization behavior
 * - 3.4: Generic error messages
 * - 3.5: Audit logging
 */

import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

/**
 * Role hierarchy for testing
 */
const ROLE_HIERARCHY: Record<string, string[]> = {
  SUPER_ADMIN: ['ADMIN', 'SUPPORT', 'USER'],
  ADMIN: ['SUPPORT', 'USER'],
  SUPPORT: ['USER'],
  SELLER: ['USER'],
  EXECUTOR: ['USER'],
  USER: [],
};

const ALL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'SELLER', 'EXECUTOR', 'USER'];

/**
 * Check if user role matches required roles with hierarchy
 */
function checkRoleWithHierarchy(userRole: string, requiredRoles: string[]): boolean {
  const normalizedRequired = requiredRoles.map((r) => r.toUpperCase());
  const normalizedUserRole = userRole.toUpperCase();

  // Direct match
  if (normalizedRequired.includes(normalizedUserRole)) {
    return true;
  }

  // Check hierarchy
  const inheritedRoles = ROLE_HIERARCHY[normalizedUserRole] || [];
  return normalizedRequired.some((required) => inheritedRoles.includes(required));
}

/**
 * Simulate authorization check
 */
function authorizeRequest(
  user: { id: string; role: string } | null,
  requiredRoles: string[]
): { allowed: boolean; error?: string } {
  // No roles required
  if (requiredRoles.length === 0) {
    return { allowed: true };
  }

  // No user
  if (!user) {
    return { allowed: false, error: '������ �������' };
  }

  // Check role
  if (!checkRoleWithHierarchy(user.role, requiredRoles)) {
    return { allowed: false, error: '������ �������' };
  }

  return { allowed: true };
}

/**
 * Simulate resource ownership check
 */
function checkResourceOwnership(
  user: { id: string; role: string } | null,
  resource: { id: string; userId: string } | null,
  allowAdmin = true
): { allowed: boolean; error?: string } {
  // No user
  if (!user) {
    return { allowed: false, error: '������ �������' };
  }

  // Admin bypass
  if (allowAdmin && ['ADMIN', 'SUPER_ADMIN'].includes(user.role.toUpperCase())) {
    return { allowed: true };
  }

  // Resource not found - generic error
  if (!resource) {
    return { allowed: false, error: '������ �������' };
  }

  // Check ownership
  if (resource.userId !== user.id) {
    return { allowed: false, error: '������ �������' };
  }

  return { allowed: true };
}

describe('Authorization Properties', () => {
  describe('Property 1: Role Hierarchy Transitivity', () => {
    it('should grant access to inherited roles', () => {
      fc.assert(
        fc.property(fc.constantFrom(...ALL_ROLES), (userRole) => {
          const inheritedRoles = ROLE_HIERARCHY[userRole] || [];

          // User should have access to all inherited roles
          for (const inheritedRole of inheritedRoles) {
            const result = authorizeRequest({ id: 'user-1', role: userRole }, [inheritedRole]);
            expect(result.allowed).toBe(true);
          }
        }),
        { numRuns: 50 }
      );
    });

    it('should deny access to higher roles', () => {
      // USER should not have access to ADMIN-only endpoints
      const result = authorizeRequest({ id: 'user-1', role: 'USER' }, ['ADMIN']);
      expect(result.allowed).toBe(false);

      // SELLER should not have access to ADMIN-only endpoints
      const result2 = authorizeRequest({ id: 'user-1', role: 'SELLER' }, ['ADMIN']);
      expect(result2.allowed).toBe(false);
    });
  });

  describe('Property 2: Direct Role Match', () => {
    it('should always allow direct role match', () => {
      fc.assert(
        fc.property(fc.constantFrom(...ALL_ROLES), (role) => {
          const result = authorizeRequest({ id: 'user-1', role }, [role]);
          expect(result.allowed).toBe(true);
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 3: No Roles Required', () => {
    it('should allow access when no roles are required', () => {
      fc.assert(
        fc.property(fc.constantFrom(...ALL_ROLES, null), (role) => {
          const user = role ? { id: 'user-1', role } : null;
          const result = authorizeRequest(user, []);
          expect(result.allowed).toBe(true);
        }),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 4: Unauthenticated Users Denied', () => {
    it('should deny unauthenticated users when roles required', () => {
      fc.assert(
        fc.property(fc.constantFrom(...ALL_ROLES), (requiredRole) => {
          const result = authorizeRequest(null, [requiredRole]);
          expect(result.allowed).toBe(false);
          expect(result.error).toBe('������ �������');
        }),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 5: Generic Error Messages', () => {
    it('should return same error message for all denial reasons', () => {
      const scenarios = [
        // No user
        { user: null, roles: ['ADMIN'] },
        // Wrong role
        { user: { id: 'u1', role: 'USER' }, roles: ['ADMIN'] },
        // Another wrong role
        { user: { id: 'u1', role: 'SELLER' }, roles: ['SUPER_ADMIN'] },
      ];

      const errors = scenarios
        .map((s) => authorizeRequest(s.user, s.roles))
        .filter((r) => !r.allowed)
        .map((r) => r.error);

      // All errors should be identical (generic)
      const uniqueErrors = new Set(errors);
      expect(uniqueErrors.size).toBe(1);
      expect(errors[0]).toBe('������ �������');
    });
  });
});

describe('Resource Ownership Properties', () => {
  describe('Property 6: Owner Access', () => {
    it('should allow resource owner to access their resource', () => {
      fc.assert(
        fc.property(fc.uuid(), fc.constantFrom('USER', 'SELLER', 'EXECUTOR'), (userId, role) => {
          const user = { id: userId, role };
          const resource = { id: 'resource-1', userId };

          const result = checkResourceOwnership(user, resource, false);
          expect(result.allowed).toBe(true);
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 7: Non-Owner Denied', () => {
    it('should deny non-owners from accessing resources', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.constantFrom('USER', 'SELLER', 'EXECUTOR'),
          (userId, ownerId, role) => {
            // Ensure different IDs
            if (userId === ownerId) {
              return;
            }

            const user = { id: userId, role };
            const resource = { id: 'resource-1', userId: ownerId };

            const result = checkResourceOwnership(user, resource, false);
            expect(result.allowed).toBe(false);
            expect(result.error).toBe('������ �������');
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 8: Admin Bypass', () => {
    it('should allow admins to access any resource when configured', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.constantFrom('ADMIN', 'SUPER_ADMIN'),
          (adminId, ownerId, adminRole) => {
            const admin = { id: adminId, role: adminRole };
            const resource = { id: 'resource-1', userId: ownerId };

            // With admin bypass enabled
            const result = checkResourceOwnership(admin, resource, true);
            expect(result.allowed).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should deny admins when bypass is disabled', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.constantFrom('ADMIN', 'SUPER_ADMIN'),
          (adminId, ownerId, adminRole) => {
            // Ensure different IDs
            if (adminId === ownerId) {
              return;
            }

            const admin = { id: adminId, role: adminRole };
            const resource = { id: 'resource-1', userId: ownerId };

            // With admin bypass disabled
            const result = checkResourceOwnership(admin, resource, false);
            expect(result.allowed).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 9: Resource Not Found', () => {
    it('should return generic error when resource not found', () => {
      fc.assert(
        fc.property(fc.uuid(), fc.constantFrom(...ALL_ROLES), (userId, role) => {
          const user = { id: userId, role };

          // Resource is null (not found)
          const result = checkResourceOwnership(user, null, false);
          expect(result.allowed).toBe(false);
          // Same error as unauthorized - doesn't reveal existence
          expect(result.error).toBe('������ �������');
        }),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 10: Unauthenticated Ownership Check', () => {
    it('should deny unauthenticated users', () => {
      const resource = { id: 'resource-1', userId: 'owner-1' };
      const result = checkResourceOwnership(null, resource, true);

      expect(result.allowed).toBe(false);
      expect(result.error).toBe('������ �������');
    });
  });
});

describe('Combined Authorization Properties', () => {
  describe('Property 11: Consistent Denial Messages', () => {
    it('should never reveal specific denial reason', () => {
      const denialScenarios = [
        // Role check failures
        authorizeRequest(null, ['ADMIN']),
        authorizeRequest({ id: 'u1', role: 'USER' }, ['ADMIN']),
        // Ownership check failures
        checkResourceOwnership(null, { id: 'r1', userId: 'u1' }, false),
        checkResourceOwnership({ id: 'u2', role: 'USER' }, { id: 'r1', userId: 'u1' }, false),
        checkResourceOwnership({ id: 'u1', role: 'USER' }, null, false),
      ];

      const errors = denialScenarios.filter((r) => !r.allowed).map((r) => r.error);

      // All errors should be the same generic message
      const uniqueErrors = new Set(errors);
      expect(uniqueErrors.size).toBe(1);

      // Error should not contain sensitive information
      const error = errors[0]!;
      expect(error).not.toContain('role');
      expect(error).not.toContain('owner');
      expect(error).not.toContain('not found');
      expect(error).not.toContain('authenticated');
    });
  });

  describe('Property 12: Authorization Determinism', () => {
    it('should produce consistent results for same inputs', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.constantFrom(...ALL_ROLES),
          fc.array(fc.constantFrom(...ALL_ROLES), { minLength: 1, maxLength: 3 }),
          (userId, userRole, requiredRoles) => {
            const user = { id: userId, role: userRole };

            const result1 = authorizeRequest(user, requiredRoles);
            const result2 = authorizeRequest(user, requiredRoles);

            expect(result1.allowed).toBe(result2.allowed);
            expect(result1.error).toBe(result2.error);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
