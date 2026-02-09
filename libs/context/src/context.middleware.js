const __decorate =
  (this && this.__decorate) ||
  ((decorators, target, key, desc) => {
    const c = arguments.length;
    let r =
      c < 3 ? target : desc === null ? (desc = Object.getOwnPropertyDescriptor(target, key)) : desc;
    let d;
    if (typeof Reflect === 'object' && typeof Reflect.decorate === 'function') {
      r = Reflect.decorate(decorators, target, key, desc);
    } else {
      for (let i = decorators.length - 1; i >= 0; i--) {
        if ((d = decorators[i])) {
          r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
        }
      }
    }
    return c > 3 && r && Object.defineProperty(target, key, r), r;
  });
const __metadata =
  (this && this.__metadata) ||
  ((k, v) => {
    if (typeof Reflect === 'object' && typeof Reflect.metadata === 'function') {
      return Reflect.metadata(k, v);
    }
  });
let ContextMiddleware_1;
Object.defineProperty(exports, '__esModule', { value: true });
exports.ContextMiddleware = void 0;
const common_1 = require('@nestjs/common');
const context_service_1 = require('./context.service');
const uuid_1 = require('uuid');
let ContextMiddleware = (ContextMiddleware_1 = class ContextMiddleware {
  constructor(contextService) {
    Object.defineProperty(this, 'contextService', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: contextService,
    });
    Object.defineProperty(this, 'logger', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: new common_1.Logger(ContextMiddleware_1.name),
    });
  }
  use(req, res, next) {
    try {
      const requestId =
        req.headers['x-request-id'] || req.headers['x-trace-id'] || (0, uuid_1.v4)();
      res.setHeader('x-request-id', requestId);
      const tenantId = this.extractTenantId(req);
      const ipAddress = this.getClientIp(req);
      const userAgent = req.get('User-Agent') || 'unknown';
      if (req.user) {
        const context = {
          tenantId,
          userId: req.user.id,
          roles: req.user.roles || [],
          isAuthenticated: true,
          requestId,
          locale: req.headers['accept-language']?.split(',')[0] || 'fa-IR',
          ipAddress,
          userAgent,
          timestamp: new Date(),
        };
        this.contextService.setContext(context);
        this.logger.debug('Context created', {
          tenantId: context.tenantId,
          userId: context.userId,
          isAuthenticated: context.isAuthenticated,
          requestId: context.requestId,
          path: req.path,
        });
      } else {
        const context = {
          tenantId,
          roles: [],
          isAuthenticated: false,
          requestId,
          locale: req.headers['accept-language']?.split(',')[0] || 'fa-IR',
          ipAddress,
          userAgent,
          timestamp: new Date(),
        };
        this.contextService.setContext(context);
      }
      next();
    } catch (error) {
      this.logger.error('Failed to create context', error);
      const fallbackContext = {
        tenantId: 'default',
        roles: [],
        isAuthenticated: false,
        requestId: (0, uuid_1.v4)(),
        locale: 'fa-IR',
        timestamp: new Date(),
      };
      this.contextService.setContext(fallbackContext);
      next();
    }
  }
  extractTenantId(req) {
    if (req.user?.tenant_id) {
      return req.user.tenant_id;
    }
    const headerTenantId = req.headers['x-tenant-id'];
    if (headerTenantId) {
      return headerTenantId;
    }
    const queryTenantId = req.query?.tenant_id;
    if (queryTenantId) {
      return queryTenantId;
    }
    const host = req.get('Host');
    if (host) {
      const subdomain = host.split('.')[0];
      if (subdomain && subdomain !== 'api' && subdomain !== 'www') {
        return subdomain;
      }
    }
    return 'default';
  }
  getClientIp(req) {
    return (
      req.headers['x-forwarded-for']?.split(',')[0] ||
      req.headers['x-real-ip'] ||
      req.ip ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      'unknown'
    );
  }
});
exports.ContextMiddleware = ContextMiddleware;
exports.ContextMiddleware =
  ContextMiddleware =
  ContextMiddleware_1 =
    __decorate(
      [
        (0, common_1.Injectable)(),
        __metadata('design:paramtypes', [context_service_1.ContextService]),
      ],
      ContextMiddleware
    );
//# sourceMappingURL=context.middleware.js.map
