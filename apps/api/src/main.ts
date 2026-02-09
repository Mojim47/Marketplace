import 'tsconfig-paths/register';
import { BadRequestException, Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import 'reflect-metadata';
import { EnvironmentValidationService, loadEnvFiles, validateEnv } from '@nextgen/config';
import type { ValidationError } from 'class-validator';
import { AppModule } from './app.module';
import { UserRateLimitGuard } from './common/guards/user-rate-limit.guard';

// Environment validation service is provided by @nextgen/config

/**
 * Custom exception factory for ValidationPipe
 *
 * Security features:
 * - Does not expose internal field names in production
 * - Provides generic error messages
 * - Logs detailed errors server-side for debugging
 */
function createValidationExceptionFactory(logger: Logger) {
  return (errors: ValidationError[]) => {
    const isProduction = process.env.NODE_ENV === 'production';

    // Log detailed errors server-side
    if (errors.length > 0) {
      const errorDetails = errors.map((err) => ({
        field: err.property,
        constraints: err.constraints,
        value: typeof err.value === 'string' ? '[REDACTED]' : typeof err.value,
      }));
      logger.warn(`Validation failed: ${JSON.stringify(errorDetails)}`);
    }

    if (isProduction) {
      // Generic message in production - don't expose field names
      return new BadRequestException({
        statusCode: 400,
        message: 'داده‌هاي ورودي نامعتبر است',
        error: 'Bad Request',
      });
    }

    // Detailed messages in development
    const messages = errors.flatMap((err) => Object.values(err.constraints || {}));

    return new BadRequestException({
      statusCode: 400,
      message: messages.length > 0 ? messages : 'داده‌هاي ورودي نامعتبر است',
      error: 'Bad Request',
    });
  };
}

async function bootstrap() {
  loadEnvFiles();
  validateEnv({ service: 'api' });
  const logger = new Logger('Bootstrap');

  // ???????????????????????????????????????????????????????????????????????????
  // CRITICAL: Environment Validation at Startup
  // Requirements: 5.2, 5.6 - Refuse to start if any required variables are missing
  // ???????????????????????????????????????????????????????????????????????????

  if (EnvironmentValidationService) {
    logger.log('?? Validating environment configuration...');

    const envValidator = new EnvironmentValidationService('api');
    const validationResult = envValidator.validateAtStartup();

    if (!validationResult.success) {
      logger.error('? Environment validation failed! Application cannot start.');
      logger.error('');

      // Log detailed validation report
      const report = envValidator.generateValidationReport();
      console.error(report);

      // Requirements: 5.6 - Exit with non-zero code on validation failure
      logger.error('?? Fix the above environment issues and restart the application.');
      process.exit(1);
    }

    // Log warnings if any
    if (validationResult.warnings && validationResult.warnings.length > 0) {
      logger.warn(`??  Found ${validationResult.warnings.length} environment warning(s):`);
      validationResult.warnings.forEach((warning, index) => {
        logger.warn(`   ${index + 1}. ${warning.field}: ${warning.message}`);
        logger.warn(`      ?? ${warning.recommendation}`);
      });
      logger.warn('');
    }

    logger.log('? Environment validation passed! Starting application...');
  } else {
    logger.warn('??  Environment validation service not available, proceeding without validation');
    logger.warn('   This should only happen during development with missing dependencies');
  }

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // Global user-aware rate limiting (per-user or per-IP)
  app.useGlobalGuards(app.get(UserRateLimitGuard));

  const configService = app.get(ConfigService);
  const PORT = configService.get<number>('API_PORT') || 3001;
  const HOST = configService.get<string>('API_HOST') || '0.0.0.0';
  const isProduction = configService.get<string>('NODE_ENV') === 'production';
  const corsOriginsRaw = configService.get<string>('CORS_ORIGINS');

  // Requirements: 12.1, 12.2 - CORS_ORIGINS must be configured in production
  if (isProduction && !corsOriginsRaw) {
    logger.error('? CORS_ORIGINS is required in production environment');
    logger.error('   Set CORS_ORIGINS environment variable with comma-separated allowed origins');
    logger.error('   Example: CORS_ORIGINS=https://example.com,https://admin.example.com');
    process.exit(1);
  }

  // In non-production, warn but allow localhost for development
  if (!corsOriginsRaw) {
    logger.warn('?? CORS_ORIGINS not configured - using localhost for development only');
  }

  // Parse and validate CORS origins
  const corsOrigins = corsOriginsRaw
    ? corsOriginsRaw
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    : ['http://localhost:3000'];

  // Requirements: 12.3 - Validate CORS origins format
  const invalidOrigins = corsOrigins.filter((origin) => {
    // Check if origin is a valid URL format
    try {
      const url = new URL(origin);
      // In production, reject localhost origins
      if (isProduction && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) {
        return true;
      }
      return false;
    } catch {
      return true; // Invalid URL format
    }
  });

  if (invalidOrigins.length > 0) {
    logger.error(`? Invalid CORS origins detected: ${invalidOrigins.join(', ')}`);
    if (isProduction) {
      logger.error('   Production environment cannot use localhost origins');
      process.exit(1);
    }
  }

  logger.log(`?? CORS configured with origins: ${corsOrigins.join(', ')}`);

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) {
        callback(null, true);
        return;
      }

      // Check if origin is in allowed list
      if (corsOrigins.includes(origin)) {
        callback(null, true);
      } else {
        // Requirements: 12.4 - Reject unauthorized origins
        logger.warn(`?? CORS blocked request from unauthorized origin: ${origin}`);
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  });

  app.use(helmet());

  /**
   * Strict ValidationPipe Configuration
   *
   * Security features:
   * - whitelist: Strip properties not in DTO
   * - forbidNonWhitelisted: Reject requests with extra properties
   * - forbidUnknownValues: Reject unknown values in nested objects
   * - transform: Auto-transform payloads to DTO instances
   * - transformOptions.enableImplicitConversion: Type coercion
   * - Custom exception factory for secure error messages
   */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: createValidationExceptionFactory(new Logger('Validation')),
    })
  );

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // Swagger API Documentation
  // Requirements: 11.1, 11.2, 11.4
  // Only expose Swagger in non-production or if explicitly enabled
  const enableSwagger = !isProduction || configService.get<string>('ENABLE_SWAGGER') === 'true';
  if (enableSwagger) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('NextGen Marketplace API')
      .setDescription('Enterprise e-commerce platform API for Iranian market with B2B capabilities')
      .setVersion('3.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'Authorization',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth'
      )
      .addTag('health', 'Health check endpoints')
      .addTag('auth', 'Authentication and authorization')
      .addTag('users', 'User management')
      .addTag('products', 'Product catalog')
      .addTag('orders', 'Order management')
      .addTag('payment', 'Payment processing')
      .addTag('vendors', 'Vendor management')
      .addTag('inventory', 'Inventory management')
      .addTag('shipping', 'Shipping and delivery')
      .addTag('tax', 'Tax and Moodian integration')
      .addServer(isProduction ? 'https://api.example.com' : `http://${HOST}:${PORT}`)
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig, {
      operationIdFactory: (_controllerKey: string, methodKey: string) => methodKey,
      deepScanRoutes: true,
    });

    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'none',
        filter: true,
        showRequestDuration: true,
      },
      customSiteTitle: 'NextGen API Documentation',
    });
    logger.log('?? Swagger UI enabled at /api/docs');
  } else {
    logger.log('?? Swagger UI disabled in production (set ENABLE_SWAGGER=true to enable)');
  }

  await app.listen(PORT, HOST);

  logger.log(`? API: http://${HOST}:${PORT}`);
  logger.log(`?? Docs: http://${HOST}:${PORT}/api/docs`);
}

bootstrap().catch((error: Error) => {
  const logger = new Logger('Bootstrap');
  logger.error('Failed to start', error.stack);
  process.exit(1);
});
