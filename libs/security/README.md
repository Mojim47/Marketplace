# @nextgen/security

Enterprise-grade security library for NextGen Marketplace with comprehensive audit logging, RBAC, threat detection, and CSRF protection.

## Features

### 🔐 Audit Logging
- **Dual Storage**: Redis for real-time + PostgreSQL for permanent storage
- **Critical Events Tracking**: Automatic identification and separate storage
- **Advanced Queries**: Filtering, pagination, and statistics
- **Data Retention**: Configurable cleanup with production safeguards
- **Graceful Degradation**: Continues operation even if storage fails

### 🛡️ Role-Based Access Control (RBAC)
- **Multi-tenant Support**: Isolated permissions per tenant
- **Redis Caching**: Fast permission lookups with 5-minute TTL
- **Database Persistence**: PostgreSQL for permanent role assignments
- **Dynamic Permissions**: Runtime permission evaluation

### 🚨 Threat Detection
- **Pattern Matching**: SQL injection, XSS, path traversal detection
- **IP Reputation**: Blacklist checking and violation tracking
- **User Agent Analysis**: Suspicious bot and scanner detection
- **Risk Scoring**: 0-100 scale with configurable thresholds
- **Automated Actions**: ALLOW, BLOCK, or CHALLENGE based on risk

### 🔒 CSRF Protection
- **Double-Submit Cookie Pattern**: Industry-standard protection
- **Redis Token Storage**: Distributed token validation
- **Configurable Exemptions**: Whitelist for webhooks and public endpoints
- **Automatic Token Rotation**: 1-hour TTL with seamless renewal

### ✅ Environment Validation
- **Secret Strength Checking**: Detects weak or default values
- **Production Safeguards**: Validates production-specific settings
- **External Service Config**: ZarinPal, CORS, database validation
- **Comprehensive Reporting**: Errors, warnings, and weak secrets

## Installation

```bash
pnpm add @nextgen/security
```

## Dependencies

- `@nestjs/common` ^10.0.0
- `@nestjs/passport` ^10.0.0
- `@nextgen/prisma` (workspace)
- `ioredis` ^5.3.0
- `zod` ^3.22.4

## Usage

### Audit Logging

```typescript
import { AuditLogService } from '@nextgen/security';

// Log user authentication
await auditLogService.log({
  userId: 'user-123',
  tenantId: 'tenant-456',
  action: 'USER_LOGIN',
  resource: 'auth',
  success: true,
  ipAddress: '192.168.1.100',
  userAgent: 'Mozilla/5.0...',
  details: {
    method: '2FA',
    provider: 'local',
  },
});

// Query logs by tenant
const { logs, total } = await auditLogService.getLogsByTenant('tenant-456', {
  limit: 50,
  offset: 0,
  action: 'USER_LOGIN',
  success: true,
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31'),
});

// Get security events
const securityEvents = await auditLogService.getSecurityEvents('tenant-456', 100);

// Get statistics
const stats = await auditLogService.getAuditStatistics('tenant-456', 'day');
console.log(stats.totalEvents, stats.criticalEvents, stats.riskScoreAverage);

// Cleanup old logs (90 days retention)
const { deletedCount } = await auditLogService.cleanupOldLogs(90);
```

### RBAC

```typescript
import { RBACService } from '@nextgen/security';

// Check if user has role
const hasRole = await rbacService.hasRole('user-123', 'ADMIN', 'tenant-456');

// Check permission
const hasPermission = await rbacService.hasPermission(
  'user-123',
  'products',
  'write',
  'tenant-456'
);

// Assign role
await rbacService.assignRole('user-123', 'SELLER', 'tenant-456');

// Revoke role
await rbacService.revokeRole('user-123', 'SELLER', 'tenant-456');

// Get user permissions
const permissions = await rbacService.getUserPermissions('user-123', 'tenant-456');
```

### Threat Detection

```typescript
import { ThreatDetectionService } from '@nextgen/security';

// Analyze request
const result = await threatDetectionService.analyzeRequest({
  userId: 'user-123',
  ipAddress: '192.168.1.100',
  userAgent: 'Mozilla/5.0...',
  endpoint: '/api/products',
  method: 'GET',
  headers: request.headers,
});

if (result.isThreat && result.action === 'BLOCK') {
  throw new ForbiddenException('Access denied due to security policy');
}

// Check IP blacklist
const isBlacklisted = await threatDetectionService.isIpBlacklisted('10.0.0.50');

// Add to blacklist
await threatDetectionService.addToBlacklist('10.0.0.50', 3600); // 1 hour
```

### JWT Auth Guard

```typescript
import { JwtAuthGuard } from '@nextgen/security';

@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  @Get()
  async findAll(@Request() req) {
    // req.securityContext contains:
    // - userId, tenantId, roles, permissions
    // - sessionId, ipAddress, userAgent, requestId
    return this.productsService.findAll(req.securityContext);
  }

  @Public() // Bypass authentication
  @Get('public')
  async getPublicProducts() {
    return this.productsService.getPublic();
  }
}
```

### CSRF Middleware

```typescript
import { CSRFMiddleware } from '@nextgen/security';

// In your module
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CSRFMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}

// Frontend: Include CSRF token in requests
const csrfToken = getCookie('csrf-token');
fetch('/api/products', {
  method: 'POST',
  headers: {
    'x-csrf-token': csrfToken,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(data),
});
```

### Environment Validation

```typescript
import { EnvironmentValidatorService } from '@nextgen/security';

const validator = new EnvironmentValidatorService();
const result = validator.validate();

if (!result.isValid) {
  console.error('Environment validation failed:', result.errors);
  process.exit(1);
}

if (result.warnings.length > 0) {
  console.warn('Environment warnings:', result.warnings);
}

if (result.weakSecrets.length > 0) {
  console.warn('Weak secrets detected:', result.weakSecrets);
}
```

## Configuration

### Environment Variables

```bash
# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-secure-password

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/nextgen

# Security
JWT_SECRET=your-jwt-secret-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars
MASTER_ENCRYPTION_KEY=your-encryption-key-min-32-chars

# Application
NODE_ENV=production
```

### Database Schema

The library requires the following Prisma models:

```prisma
model AuditLog {
  id          String   @id @default(cuid())
  tenantId    String?
  userId      String?
  action      String
  resource    String
  success     Boolean
  ipAddress   String?
  userAgent   String?
  riskScore   Float?
  metadata    Json     @default("{}")
  timestamp   DateTime @default(now())
  
  @@index([tenantId])
  @@index([userId])
  @@index([tenantId, action])
  @@index([tenantId, timestamp])
}

model UserRoleAssignment {
  id         String   @id @default(cuid())
  userId     String
  roleName   String
  tenantId   String
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  
  @@unique([userId, roleName, tenantId])
  @@index([userId, tenantId])
}

model RolePermission {
  id           String   @id @default(cuid())
  roleName     String
  permissionId String
  tenantId     String
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  
  permission   Permission @relation(fields: [permissionId], references: [id])
  
  @@unique([roleName, permissionId, tenantId])
  @@index([roleName, tenantId])
}

model Permission {
  id         String   @id @default(cuid())
  name       String
  resource   String
  action     String
  conditions Json?
  createdAt  DateTime @default(now())
  
  rolePermissions RolePermission[]
  
  @@unique([resource, action])
}
```

## Testing

```bash
# Run all tests
pnpm test --filter @nextgen/security

# Run with coverage
pnpm test:coverage --filter @nextgen/security

# Type checking
pnpm typecheck --filter @nextgen/security
```

## Architecture

### Audit Log Flow
```
Request → AuditLogService.log()
  ├─→ Redis (real-time, last 10K entries)
  ├─→ Redis (critical events, last 2K entries)
  ├─→ PostgreSQL (permanent storage)
  └─→ NestJS Logger (application logs)
```

### RBAC Flow
```
Request → hasPermission()
  ├─→ Redis Cache (5min TTL)
  │   └─→ Cache Hit → Return
  └─→ Cache Miss
      ├─→ Fetch from PostgreSQL
      ├─→ Store in Redis
      └─→ Return
```

### Threat Detection Flow
```
Request → analyzeRequest()
  ├─→ Pattern Matching (SQL, XSS, etc.)
  ├─→ IP Reputation Check
  ├─→ User Agent Analysis
  ├─→ Rate Limiting Check
  └─→ Calculate Risk Score
      ├─→ < 30: ALLOW
      ├─→ 30-70: CHALLENGE
      └─→ > 70: BLOCK
```

## Performance

- **Audit Logging**: < 5ms (Redis) + async PostgreSQL
- **RBAC Permission Check**: < 2ms (cached) / < 10ms (uncached)
- **Threat Detection**: < 15ms per request
- **CSRF Validation**: < 3ms (Redis lookup)

## Security Best Practices

1. **Secrets Management**: Use strong, unique secrets (min 32 chars)
2. **Production Settings**: Disable sandbox mode, use HTTPS
3. **Data Retention**: Configure appropriate retention periods
4. **Rate Limiting**: Implement at application level
5. **Monitoring**: Set up alerts for critical security events
6. **Regular Audits**: Review audit logs and security statistics

## License

Proprietary - NextGen Marketplace

## Support

For issues and questions, contact the security team.
