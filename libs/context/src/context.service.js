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
let ContextService_1;
Object.defineProperty(exports, '__esModule', { value: true });
exports.ContextService = void 0;
const common_1 = require('@nestjs/common');
let ContextService = (ContextService_1 = class ContextService {
  constructor() {
    Object.defineProperty(this, 'logger', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: new common_1.Logger(ContextService_1.name),
    });
    Object.defineProperty(this, 'context', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: null,
    });
    Object.defineProperty(this, 'tenantContext', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: null,
    });
    Object.defineProperty(this, 'userContext', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: null,
    });
    Object.defineProperty(this, 'initialized', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: false,
    });
  }
  setContext(context) {
    if (this.initialized) {
      throw new Error('Context already initialized - immutable after first set');
    }
    this.context = Object.freeze({
      ...context,
      roles: Object.freeze([...context.roles]),
      timestamp: new Date(),
    });
    this.initialized = true;
  }
  getContext() {
    if (!this.context) {
      throw new Error('Context not initialized');
    }
    return this.context;
  }
  getCurrentTenantId() {
    const context = this.getContext();
    return context.tenantId;
  }
  getCurrentUserId() {
    const context = this.getContext();
    return context.userId;
  }
  isAuthenticated() {
    const context = this.getContext();
    return context.isAuthenticated;
  }
  hasRole(role) {
    const context = this.getContext();
    return context.roles.includes(role);
  }
  hasAnyRole(roles) {
    const context = this.getContext();
    return roles.some((role) => context.roles.includes(role));
  }
  setTenantContext(tenant) {
    this.tenantContext = tenant;
  }
  getTenantContext() {
    return this.tenantContext;
  }
  setUserContext(user) {
    this.userContext = user;
  }
  getUserContext() {
    return this.userContext;
  }
  getRequestId() {
    return this.context?.requestId;
  }
  createChildContext(overrides) {
    const currentContext = this.getContext();
    return {
      ...currentContext,
      ...overrides,
      timestamp: new Date(),
    };
  }
  logContextInfo() {
    if (this.context) {
      this.logger.log('Context Info', {
        tenantId: this.context.tenantId,
        userId: this.context.userId,
        roles: this.context.roles,
        isAuthenticated: this.context.isAuthenticated,
        requestId: this.context.requestId,
      });
    }
  }
});
exports.ContextService = ContextService;
exports.ContextService =
  ContextService =
  ContextService_1 =
    __decorate([(0, common_1.Injectable)({ scope: common_1.Scope.REQUEST })], ContextService);
//# sourceMappingURL=context.service.js.map
