import { describe, it, expect } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import {
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  BusinessRuleError,
  DomainError,
  RateLimitError,
  InternalError,
  UnavailableError,
  ErrorCode,
  AppError,
} from './index';

describe('Unified Error System', () => {
  describe('ValidationError (400) - Schema/Format Only', () => {
    it('maps to BAD_REQUEST status', () => {
      const error = ValidationError.invalidInput('email', 'invalid format');
      expect(error.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(error.code).toBe(ErrorCode.INVALID_INPUT);
    });

    it('produces consistent response', () => {
      const error = ValidationError.missingField('password');
      const response = error.toResponse('/api/login', 'req-123');

      expect(response.statusCode).toBe(400);
      expect(response.code).toBe(ErrorCode.MISSING_REQUIRED_FIELD);
      expect(response.path).toBe('/api/login');
      expect(response.requestId).toBe('req-123');
      expect(response.details).toEqual({ field: 'password' });
    });

    it('handles schema validation failures', () => {
      const error = ValidationError.schemaValidationFailed([
        { field: 'email', message: 'Invalid email' },
        { field: 'age', message: 'Must be positive' },
      ]);
      expect(error.code).toBe(ErrorCode.VALIDATION_FAILED);
      expect(error.details?.errors).toHaveLength(2);
    });
  });

  describe('AuthenticationError (401)', () => {
    it('maps to UNAUTHORIZED status', () => {
      const error = AuthenticationError.invalidCredentials();
      expect(error.statusCode).toBe(HttpStatus.UNAUTHORIZED);
      expect(error.code).toBe(ErrorCode.INVALID_CREDENTIALS);
    });

    it('handles token expiry', () => {
      const error = AuthenticationError.tokenExpired();
      expect(error.code).toBe(ErrorCode.TOKEN_EXPIRED);
      expect(error.messageFA).toBe('توکن منقضی شده است');
    });
  });

  describe('AuthorizationError (403)', () => {
    it('maps to FORBIDDEN status', () => {
      const error = AuthorizationError.insufficientPermissions('orders.write');
      expect(error.statusCode).toBe(HttpStatus.FORBIDDEN);
      expect(error.code).toBe(ErrorCode.INSUFFICIENT_PERMISSIONS);
    });
  });

  describe('NotFoundError (404)', () => {
    it('maps to NOT_FOUND status', () => {
      const error = NotFoundError.resource('User', 'user@example.com');
      expect(error.statusCode).toBe(HttpStatus.NOT_FOUND);
      expect(error.code).toBe(ErrorCode.RESOURCE_NOT_FOUND);
    });

    it('handles byId lookup', () => {
      const error = NotFoundError.byId('Order', 'ord-123');
      expect(error.message).toBe('Order with ID ord-123 not found');
      expect(error.details).toEqual({ resource: 'Order', id: 'ord-123' });
    });
  });

  describe('ConflictError (409) - Resource Conflicts', () => {
    it('maps to CONFLICT status', () => {
      const error = ConflictError.resourceExists('User', 'test@example.com');
      expect(error.statusCode).toBe(HttpStatus.CONFLICT);
      expect(error.code).toBe(ErrorCode.RESOURCE_EXISTS);
    });

    it('handles optimistic lock failures', () => {
      const error = ConflictError.optimisticLockFailed('Product');
      expect(error.code).toBe(ErrorCode.OPTIMISTIC_LOCK_FAILED);
      expect(error.messageFA).toBe('تغییر همزمان شناسایی شد. لطفاً دوباره تلاش کنید');
    });
  });

  describe('BusinessRuleError (422) - Business Logic', () => {
    it('maps to UNPROCESSABLE_ENTITY status', () => {
      const error = BusinessRuleError.violation('Order total exceeds credit limit');
      expect(error.statusCode).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(error.code).toBe(ErrorCode.BUSINESS_RULE_VIOLATION);
    });

    it('handles minimum amount violations', () => {
      const error = BusinessRuleError.minimumAmountNotMet('amount', 1000, 'Rials');
      expect(error.code).toBe(ErrorCode.MINIMUM_AMOUNT_NOT_MET);
      expect(error.details).toEqual({ field: 'amount', minimum: 1000, currency: 'Rials' });
    });

    it('handles insufficient balance', () => {
      const error = BusinessRuleError.insufficientBalance('acc-123', 5000, 3000);
      expect(error.code).toBe(ErrorCode.INSUFFICIENT_BALANCE);
      expect(error.details).toEqual({ accountId: 'acc-123', required: 5000, available: 3000 });
    });

    it('handles invalid state transitions', () => {
      const error = BusinessRuleError.invalidStateTransition('pending', 'shipped', 'Order');
      expect(error.code).toBe(ErrorCode.INVALID_STATE_TRANSITION);
    });

    it('handles insufficient inventory', () => {
      const error = BusinessRuleError.insufficientInventory('prod-123', 10, 5);
      expect(error.details).toEqual({ productId: 'prod-123', requested: 10, available: 5 });
    });

    it('handles credit limit exceeded', () => {
      const error = BusinessRuleError.creditLimitExceeded('cust-123', 100000, 150000);
      expect(error.messageFA).toBe('سقف اعتبار مشتری تمام شده است');
    });

    it('handles order not modifiable', () => {
      const error = BusinessRuleError.orderNotModifiable('ord-123', 'shipped');
      expect(error.messageFA).toBe('سفارش در این وضعیت قابل تغییر نیست');
    });

    it('handles maximum limit exceeded', () => {
      const error = BusinessRuleError.maximumLimitExceeded('quantity', 100, 'items');
      expect(error.code).toBe(ErrorCode.MAXIMUM_LIMIT_EXCEEDED);
    });
  });

  describe('DomainError (409) - Legacy', () => {
    it('still works for backward compatibility', () => {
      const error = DomainError.resourceExists('User', 'test@example.com');
      expect(error.statusCode).toBe(HttpStatus.CONFLICT);
      expect(error.code).toBe(ErrorCode.RESOURCE_EXISTS);
    });
  });

  describe('RateLimitError (429)', () => {
    it('maps to TOO_MANY_REQUESTS status', () => {
      const error = RateLimitError.tooManyRequests(60);
      expect(error.statusCode).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
      expect(error.details).toEqual({ retryAfterSeconds: 60 });
    });

    it('handles quota exceeded', () => {
      const error = RateLimitError.quotaExceeded('API calls', 1000);
      expect(error.details).toEqual({ resource: 'API calls', limit: 1000 });
    });
  });

  describe('InternalError (500) - Infrastructure', () => {
    it('maps to INTERNAL_SERVER_ERROR status', () => {
      const error = InternalError.database('insert');
      expect(error.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(error.code).toBe(ErrorCode.DATABASE_ERROR);
    });

    it('handles transaction timeout', () => {
      const error = InternalError.transactionTimeout(30000);
      expect(error.code).toBe(ErrorCode.TRANSACTION_TIMEOUT);
      expect(error.details).toEqual({ timeoutMs: 30000 });
    });

    it('handles unknown errors', () => {
      const error = InternalError.unknown('payment processing');
      expect(error.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(error.details).toEqual({ context: 'payment processing' });
    });
  });

  describe('UnavailableError (503)', () => {
    it('maps to SERVICE_UNAVAILABLE status', () => {
      const error = UnavailableError.serviceUnavailable('Payment Gateway', 300);
      expect(error.statusCode).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(error.code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
      expect(error.details).toEqual({ service: 'Payment Gateway', retryAfterSeconds: 300 });
    });

    it('handles maintenance mode', () => {
      const error = UnavailableError.maintenanceMode('2024-01-15T10:00:00Z');
      expect(error.code).toBe(ErrorCode.MAINTENANCE_MODE);
    });
  });

  describe('Error inheritance', () => {
    it('all errors extend AppError', () => {
      expect(ValidationError.invalidInput('x', 'y')).toBeInstanceOf(AppError);
      expect(AuthenticationError.tokenExpired()).toBeInstanceOf(AppError);
      expect(AuthorizationError.insufficientPermissions('x')).toBeInstanceOf(AppError);
      expect(NotFoundError.resource('x', 'y')).toBeInstanceOf(AppError);
      expect(ConflictError.resourceExists('x', 'y')).toBeInstanceOf(AppError);
      expect(BusinessRuleError.violation('x')).toBeInstanceOf(AppError);
      expect(DomainError.resourceExists('x', 'y')).toBeInstanceOf(AppError);
      expect(RateLimitError.tooManyRequests()).toBeInstanceOf(AppError);
      expect(InternalError.database('x')).toBeInstanceOf(AppError);
      expect(UnavailableError.serviceUnavailable()).toBeInstanceOf(AppError);
    });

    it('all errors extend Error', () => {
      const error = ValidationError.invalidInput('x', 'y');
      expect(error).toBeInstanceOf(Error);
      expect(error.stack).toBeDefined();
    });
  });

  describe('Same failure produces same response', () => {
    it('identical errors produce identical responses (minus timestamp)', () => {
      const error1 = ValidationError.missingField('email');
      const error2 = ValidationError.missingField('email');

      const resp1 = error1.toResponse('/test');
      const resp2 = error2.toResponse('/test');

      expect(resp1.statusCode).toBe(resp2.statusCode);
      expect(resp1.code).toBe(resp2.code);
      expect(resp1.message).toBe(resp2.message);
      expect(resp1.details).toEqual(resp2.details);
    });
  });

  describe('Error taxonomy separation', () => {
    it('ValidationError is for schema/format only (400)', () => {
      const schemaError = ValidationError.invalidFormat('email', 'user@domain.com');
      expect(schemaError.statusCode).toBe(400);
    });

    it('ConflictError is for resource conflicts (409)', () => {
      const conflict = ConflictError.resourceExists('User', 'test@example.com');
      expect(conflict.statusCode).toBe(409);
    });

    it('BusinessRuleError is for business logic (422)', () => {
      const businessError = BusinessRuleError.minimumAmountNotMet('amount', 1000, 'Rials');
      expect(businessError.statusCode).toBe(422);
    });

    it('NotFoundError is 404, not 409', () => {
      const notFound = NotFoundError.resource('Product', 'prod-123');
      expect(notFound.statusCode).toBe(404);
      expect(notFound.code).toBe(ErrorCode.RESOURCE_NOT_FOUND);
    });

    it('InternalError is for infrastructure, not business logic (500)', () => {
      const dbError = InternalError.database('connection');
      expect(dbError.statusCode).toBe(500);

      const timeoutError = InternalError.transactionTimeout(5000);
      expect(timeoutError.statusCode).toBe(500);
      expect(timeoutError.code).toBe(ErrorCode.TRANSACTION_TIMEOUT);
    });
  });
});
