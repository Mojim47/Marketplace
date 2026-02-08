/**
 * Example NestJS Application using Security Module
 *
 * This example demonstrates how to integrate the security library
 * into a NestJS application following strict determinism rules:
 * - No business logic in controllers
 * - No side effects in controllers
 * - No try/catch in controllers
 * - No direct DB access in controllers
 * - No console output in controllers
 * - Zod input schemas for all inputs
 * - Explicit DTO outputs
 */

import {
  Module,
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Injectable,
  UsePipes,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { z } from 'zod';
import {
  SecurityModule,
  JwtAuthGuard,
  RolesGuard,
  Public,
  Roles,
  AuditLogService,
  RBACService,
} from '@nextgen/security';
import { AuthorizationError } from '@nextgen/errors';

// ============================================================================
// Zod Input Schemas
// ============================================================================

const CreateProductSchema = z.object({
  name: z.string().min(1).max(255),
  price: z.number().positive(),
  description: z.string().optional(),
});

const AssignRoleSchema = z.object({
  userId: z.string().uuid(),
  roleName: z.string().min(1),
});

const RevokeRoleSchema = z.object({
  userId: z.string().uuid(),
  roleName: z.string().min(1),
});

const AuditLogsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
  action: z.string().optional(),
  success: z.enum(['true', 'false']).optional(),
});

const SecurityEventsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().default(100),
});

const StatisticsQuerySchema = z.object({
  timeRange: z.enum(['hour', 'day', 'week', 'month']).default('day'),
});

// ============================================================================
// Input Types (inferred from Zod)
// ============================================================================

type CreateProductInput = z.infer<typeof CreateProductSchema>;
type AssignRoleInput = z.infer<typeof AssignRoleSchema>;
type RevokeRoleInput = z.infer<typeof RevokeRoleSchema>;
type AuditLogsQuery = z.infer<typeof AuditLogsQuerySchema>;
type SecurityEventsQuery = z.infer<typeof SecurityEventsQuerySchema>;
type StatisticsQuery = z.infer<typeof StatisticsQuerySchema>;

// ============================================================================
// Output DTOs
// ============================================================================

interface ProductDto {
  id: number;
  name: string;
  price: number;
}

interface ProductListResponseDto {
  products: ProductDto[];
}

interface CreateProductResponseDto {
  success: true;
  product: ProductDto;
}

interface AuditLogDto {
  id: string;
  userId: string;
  action: string;
  resource: string;
  success: boolean;
  timestamp: string;
}

interface AuditLogsResponseDto {
  logs: AuditLogDto[];
  total: number;
}

interface SecurityEventDto {
  id: string;
  type: string;
  severity: string;
  timestamp: string;
}

interface SecurityEventsResponseDto {
  events: SecurityEventDto[];
}

interface AuditStatisticsDto {
  totalActions: number;
  successRate: number;
  topActions: { action: string; count: number }[];
}

interface SuccessResponseDto {
  success: true;
}

interface PermissionsResponseDto {
  permissions: string[];
}

// ============================================================================
// Zod Validation Pipe (simplified for example)
// ============================================================================

class ZodValidationPipe {
  constructor(private schema: z.ZodSchema) {}

  transform(value: unknown) {
    return this.schema.parse(value);
  }
}

// ============================================================================
// Products Service (business logic belongs here)
// ============================================================================

@Injectable()
class ProductsService {
  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly rbacService: RBACService,
  ) {}

  async getPublicProducts(): Promise<ProductListResponseDto> {
    return {
      products: [
        { id: 1, name: 'Product 1', price: 100000 },
        { id: 2, name: 'Product 2', price: 200000 },
      ],
    };
  }

  async getAllProducts(securityContext: {
    userId: string;
    tenantId: string;
    ipAddress: string;
    userAgent: string;
  }): Promise<ProductListResponseDto> {
    await this.auditLogService.log({
      userId: securityContext.userId,
      tenantId: securityContext.tenantId,
      action: 'PRODUCT_LIST_VIEW',
      resource: 'products',
      success: true,
      ipAddress: securityContext.ipAddress,
      userAgent: securityContext.userAgent,
    });

    return {
      products: [
        { id: 1, name: 'Product 1', price: 100000 },
        { id: 2, name: 'Product 2', price: 200000 },
        { id: 3, name: 'Product 3', price: 300000 },
      ],
    };
  }

  async createProduct(
    productData: CreateProductInput,
    securityContext: {
      userId: string;
      tenantId: string;
      ipAddress: string;
      userAgent: string;
    },
  ): Promise<CreateProductResponseDto> {
    const canCreate = await this.rbacService.hasPermission(
      securityContext.userId,
      'products',
      'create',
      securityContext.tenantId,
    );

    if (!canCreate) {
      await this.auditLogService.log({
        userId: securityContext.userId,
        tenantId: securityContext.tenantId,
        action: 'PRODUCT_CREATE_DENIED',
        resource: 'products',
        success: false,
        ipAddress: securityContext.ipAddress,
        userAgent: securityContext.userAgent,
        details: { reason: 'Insufficient permissions' },
      });

      throw AuthorizationError.insufficientPermissions('products.create');
    }

    await this.auditLogService.log({
      userId: securityContext.userId,
      tenantId: securityContext.tenantId,
      action: 'PRODUCT_CREATED',
      resource: 'products',
      success: true,
      ipAddress: securityContext.ipAddress,
      userAgent: securityContext.userAgent,
      details: { productData },
    });

    return {
      success: true,
      product: { id: Date.now(), ...productData },
    };
  }
}

// ============================================================================
// Audit Service (business logic belongs here)
// ============================================================================

@Injectable()
class AuditService {
  constructor(private readonly auditLogService: AuditLogService) {}

  async getLogs(
    tenantId: string,
    query: AuditLogsQuery,
  ): Promise<AuditLogsResponseDto> {
    const result = await this.auditLogService.getLogsByTenant(tenantId, {
      limit: query.limit,
      offset: query.offset,
      action: query.action,
      success:
        query.success === 'true'
          ? true
          : query.success === 'false'
            ? false
            : undefined,
    });

    return result;
  }

  async getSecurityEvents(
    tenantId: string,
    query: SecurityEventsQuery,
  ): Promise<SecurityEventsResponseDto> {
    const events = await this.auditLogService.getSecurityEvents(
      tenantId,
      query.limit,
    );

    return { events };
  }

  async getStatistics(
    tenantId: string,
    query: StatisticsQuery,
  ): Promise<AuditStatisticsDto> {
    return this.auditLogService.getAuditStatistics(tenantId, query.timeRange);
  }
}

// ============================================================================
// RBAC Service Wrapper (business logic belongs here)
// ============================================================================

@Injectable()
class RBACManagementService {
  constructor(
    private readonly rbacService: RBACService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async assignRole(
    input: AssignRoleInput,
    securityContext: {
      userId: string;
      tenantId: string;
      ipAddress: string;
      userAgent: string;
    },
  ): Promise<SuccessResponseDto> {
    await this.rbacService.assignRole(
      input.userId,
      input.roleName,
      securityContext.tenantId,
    );

    await this.auditLogService.log({
      userId: securityContext.userId,
      tenantId: securityContext.tenantId,
      action: 'ROLE_ASSIGNED',
      resource: 'rbac',
      success: true,
      ipAddress: securityContext.ipAddress,
      userAgent: securityContext.userAgent,
      details: { targetUserId: input.userId, roleName: input.roleName },
    });

    return { success: true };
  }

  async revokeRole(
    input: RevokeRoleInput,
    securityContext: {
      userId: string;
      tenantId: string;
      ipAddress: string;
      userAgent: string;
    },
  ): Promise<SuccessResponseDto> {
    await this.rbacService.revokeRole(
      input.userId,
      input.roleName,
      securityContext.tenantId,
    );

    await this.auditLogService.log({
      userId: securityContext.userId,
      tenantId: securityContext.tenantId,
      action: 'ROLE_REVOKED',
      resource: 'rbac',
      success: true,
      ipAddress: securityContext.ipAddress,
      userAgent: securityContext.userAgent,
      details: { targetUserId: input.userId, roleName: input.roleName },
    });

    return { success: true };
  }

  async getUserPermissions(
    userId: string,
    tenantId: string,
  ): Promise<PermissionsResponseDto> {
    const permissions = await this.rbacService.getUserPermissions(
      userId,
      tenantId,
    );

    return { permissions };
  }
}

// ============================================================================
// Products Controller (deterministic - no business logic)
// ============================================================================

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @Get('public')
  getPublicProducts(): Promise<ProductListResponseDto> {
    return this.productsService.getPublicProducts();
  }

  @Get()
  getAllProducts(@Request() req: any): Promise<ProductListResponseDto> {
    return this.productsService.getAllProducts({
      userId: req.securityContext.userId,
      tenantId: req.securityContext.tenantId,
      ipAddress: req.securityContext.ipAddress,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post()
  @Roles('ADMIN', 'SELLER')
  @UsePipes(new ZodValidationPipe(CreateProductSchema))
  createProduct(
    @Request() req: any,
    @Body() input: CreateProductInput,
  ): Promise<CreateProductResponseDto> {
    return this.productsService.createProduct(input, {
      userId: req.securityContext.userId,
      tenantId: req.securityContext.tenantId,
      ipAddress: req.securityContext.ipAddress,
      userAgent: req.headers['user-agent'],
    });
  }
}

// ============================================================================
// Audit Controller (deterministic - no business logic)
// ============================================================================

@Controller('admin/audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @UsePipes(new ZodValidationPipe(AuditLogsQuerySchema))
  getLogs(
    @Request() req: any,
    @Query() query: AuditLogsQuery,
  ): Promise<AuditLogsResponseDto> {
    return this.auditService.getLogs(req.securityContext.tenantId, query);
  }

  @Get('security-events')
  @UsePipes(new ZodValidationPipe(SecurityEventsQuerySchema))
  getSecurityEvents(
    @Request() req: any,
    @Query() query: SecurityEventsQuery,
  ): Promise<SecurityEventsResponseDto> {
    return this.auditService.getSecurityEvents(
      req.securityContext.tenantId,
      query,
    );
  }

  @Get('statistics')
  @UsePipes(new ZodValidationPipe(StatisticsQuerySchema))
  getStatistics(
    @Request() req: any,
    @Query() query: StatisticsQuery,
  ): Promise<AuditStatisticsDto> {
    return this.auditService.getStatistics(req.securityContext.tenantId, query);
  }
}

// ============================================================================
// RBAC Controller (deterministic - no business logic)
// ============================================================================

@Controller('admin/rbac')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class RBACController {
  constructor(private readonly rbacManagementService: RBACManagementService) {}

  @Post('assign-role')
  @UsePipes(new ZodValidationPipe(AssignRoleSchema))
  assignRole(
    @Request() req: any,
    @Body() input: AssignRoleInput,
  ): Promise<SuccessResponseDto> {
    return this.rbacManagementService.assignRole(input, {
      userId: req.securityContext.userId,
      tenantId: req.securityContext.tenantId,
      ipAddress: req.securityContext.ipAddress,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('revoke-role')
  @UsePipes(new ZodValidationPipe(RevokeRoleSchema))
  revokeRole(
    @Request() req: any,
    @Body() input: RevokeRoleInput,
  ): Promise<SuccessResponseDto> {
    return this.rbacManagementService.revokeRole(input, {
      userId: req.securityContext.userId,
      tenantId: req.securityContext.tenantId,
      ipAddress: req.securityContext.ipAddress,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('user-permissions/:userId')
  getUserPermissions(
    @Request() req: any,
    @Param('userId') userId: string,
  ): Promise<PermissionsResponseDto> {
    return this.rbacManagementService.getUserPermissions(
      userId,
      req.securityContext.tenantId,
    );
  }
}

// ============================================================================
// Application Module
// ============================================================================

@Module({
  imports: [SecurityModule],
  controllers: [ProductsController, AuditController, RBACController],
  providers: [ProductsService, AuditService, RBACManagementService],
})
export class AppModule {}

// ============================================================================
// Bootstrap Application
// ============================================================================

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env['CORS_ORIGINS']?.split(',') || ['http://localhost:3000'],
    credentials: true,
  });

  app.setGlobalPrefix('api/v3');

  await app.listen(3000);
}

// Uncomment to run
// bootstrap();
