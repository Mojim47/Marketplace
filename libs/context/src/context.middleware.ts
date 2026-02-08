// ═══════════════════════════════════════════════════════════════════════════
// Context Middleware - Request Context Initialization
// ═══════════════════════════════════════════════════════════════════════════

import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ContextService } from './context.service';
import { Context } from './context.interface';
import { v4 as uuidv4 } from 'uuid';

interface AuthenticatedUser {
  id: string;
  tenant_id: string;
  email: string;
  roles: string[];
  is_active: boolean;
}

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

@Injectable()
export class ContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ContextMiddleware.name);

  constructor(private readonly contextService: ContextService) {}

  use(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      // Generate or extract request ID
      const requestId = (req.headers['x-request-id'] as string) || 
                       (req.headers['x-trace-id'] as string) || 
                       uuidv4();

      // Set request ID in response headers
      res.setHeader('x-request-id', requestId);

      // Extract tenant ID from various sources
      const tenantId = this.extractTenantId(req);
      
      // Get client IP address
      const ipAddress = this.getClientIp(req);
      
      // Get user agent
      const userAgent = req.get('User-Agent') || 'unknown';

      // Create context for authenticated users
      if (req.user) {
        const context: Context = {
          tenantId,
          userId: req.user.id,
          roles: req.user.roles || [],
          isAuthenticated: true,
          requestId,
          locale: (req.headers['accept-language'] as string)?.split(',')[0] || 'fa-IR',
          ipAddress,
          userAgent,
          timestamp: new Date(),
        };

        this.contextService.setContext(context);

        // Log context creation for debugging
        this.logger.debug('Context created', {
          tenantId: context.tenantId,
          userId: context.userId,
          isAuthenticated: context.isAuthenticated,
          requestId: context.requestId,
          path: req.path,
        });
      } else {
        // Create context for unauthenticated users
        const context: Context = {
          tenantId,
          roles: [],
          isAuthenticated: false,
          requestId,
          locale: (req.headers['accept-language'] as string)?.split(',')[0] || 'fa-IR',
          ipAddress,
          userAgent,
          timestamp: new Date(),
        };

        this.contextService.setContext(context);
      }

      next();
    } catch (error) {
      this.logger.error('Failed to create context', error);
      
      // Create minimal context for error scenarios
      const fallbackContext: Context = {
        tenantId: 'default',
        roles: [],
        isAuthenticated: false,
        requestId: uuidv4(),
        locale: 'fa-IR',
        timestamp: new Date(),
      };
      
      this.contextService.setContext(fallbackContext);
      next();
    }
  }

  private extractTenantId(req: AuthenticatedRequest): string {
    // Priority order for tenant ID extraction:
    // 1. Authenticated user's tenant_id
    // 2. X-Tenant-ID header
    // 3. Query parameter
    // 4. Subdomain extraction
    // 5. Default tenant

    if (req.user?.tenant_id) {
      return req.user.tenant_id;
    }

    const headerTenantId = req.headers['x-tenant-id'] as string;
    if (headerTenantId) {
      return headerTenantId;
    }

    const queryTenantId = req.query?.['tenant_id'] as string;
    if (queryTenantId) {
      return queryTenantId;
    }

    // Extract from subdomain (e.g., tenant1.api.example.com)
    const host = req.get('Host');
    if (host) {
      const subdomain = host.split('.')[0];
      if (subdomain && subdomain !== 'api' && subdomain !== 'www') {
        return subdomain;
      }
    }

    // Default tenant for public access
    return 'default';
  }

  private getClientIp(req: AuthenticatedRequest): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      (req.headers['x-real-ip'] as string) ||
      req.ip ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      'unknown'
    );
  }
}