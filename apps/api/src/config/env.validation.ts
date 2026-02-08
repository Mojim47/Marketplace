import { plainToInstance } from 'class-transformer';
import { 
  IsString, 
  IsNumber, 
  IsBoolean, 
  IsOptional, 
  MinLength, 
  validateSync, 
  IsIn,
  IsUrl,
  Matches,
  ValidateIf,
} from 'class-validator';
import { Logger } from '@nestjs/common';

const logger = new Logger('EnvValidation');

/**
 * ?? Zero-Trust Environment Validation
 * 
 * Security principles:
 * - All critical secrets MUST be provided - no defaults for sensitive values
 * - Fail fast on missing secrets in production
 * - Validate secret strength (minimum lengths, patterns)
 * - No hardcoded fallback values for secrets
 */
class EnvironmentVariables {
  // ============================================
  // Core Application Settings
  // ============================================
  
  @IsString()
  @IsIn(['development', 'staging', 'production', 'test'])
  NODE_ENV!: string;

  @IsNumber()
  @IsOptional()
  PORT = 3001;

  @IsString()
  @IsOptional()
  API_HOST = '0.0.0.0';

  @IsString()
  @IsOptional()
  APP_VERSION = '1.0.0';

  // ============================================
  // Database Configuration
  // ============================================
  
  @IsString()
  @Matches(/^postgres(ql)?:\/\//, { 
    message: 'DATABASE_URL must be a valid PostgreSQL connection string' 
  })
  DATABASE_URL!: string;

  @IsString()
  @IsIn(['true', 'false'])
  @IsOptional()
  DATABASE_LOGGING = 'false';

  // ============================================
  // Redis Configuration
  // ============================================
  
  @IsString()
  @Matches(/^redis(s)?:\/\//, { 
    message: 'REDIS_URL must be a valid Redis connection string' 
  })
  REDIS_URL!: string;

  // ============================================
  // JWT Authentication Secrets
  // ============================================
  
  @IsString()
  @MinLength(64, { 
    message: 'JWT_SECRET must be at least 64 characters for production security' 
  })
  @ValidateIf(o => o.NODE_ENV === 'production')
  JWT_SECRET!: string;

  @IsString()
  @MinLength(32, { 
    message: 'JWT_SECRET must be at least 32 characters' 
  })
  @ValidateIf(o => o.NODE_ENV !== 'production')
  JWT_SECRET_DEV?: string;

  @IsString()
  @MinLength(64, { 
    message: 'JWT_REFRESH_SECRET must be at least 64 characters for production security' 
  })
  @ValidateIf(o => o.NODE_ENV === 'production')
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @MinLength(32)
  @ValidateIf(o => o.NODE_ENV !== 'production')
  JWT_REFRESH_SECRET_DEV?: string;

  @IsString()
  @IsOptional()
  JWT_ISSUER = 'nextgen-marketplace';

  @IsString()
  @IsOptional()
  JWT_AUDIENCE = 'nextgen-api';

  @IsString()
  @IsOptional()
  JWT_EXPIRATION = '15m';

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRATION = '7d';

  // ============================================
  // RSA Keys for JWT (Production)
  // ============================================
  
  @IsString()
  @ValidateIf(o => o.NODE_ENV === 'production')
  @Matches(/^-----BEGIN (RSA )?PRIVATE KEY-----/, {
    message: 'JWT_PRIVATE_KEY must be a valid RSA private key in PEM format'
  })
  JWT_PRIVATE_KEY?: string;

  @IsString()
  @ValidateIf(o => o.NODE_ENV === 'production')
  @Matches(/^-----BEGIN (RSA )?PUBLIC KEY-----/, {
    message: 'JWT_PUBLIC_KEY must be a valid RSA public key in PEM format'
  })
  JWT_PUBLIC_KEY?: string;

  // ============================================
  // TOTP/2FA Configuration
  // ============================================
  
  @IsString()
  @MinLength(32, { 
    message: 'TOTP_ENCRYPTION_KEY must be at least 32 characters' 
  })
  @ValidateIf(o => o.NODE_ENV === 'production')
  TOTP_ENCRYPTION_KEY?: string;

  // ============================================
  // Payment Gateway (ZarinPal)
  // ============================================
  
  @IsString()
  @MinLength(36, { 
    message: 'ZARINPAL_MERCHANT_ID must be a valid merchant ID' 
  })
  @ValidateIf(o => o.NODE_ENV === 'production')
  ZARINPAL_MERCHANT_ID?: string;

  @IsString()
  @IsIn(['true', 'false'])
  @IsOptional()
  ZARINPAL_SANDBOX = 'true';

  @IsString()
  @MinLength(32)
  @ValidateIf(o => o.NODE_ENV === 'production')
  ZARINPAL_WEBHOOK_SECRET?: string;

  // ============================================
  // Moodian Tax Integration
  // ============================================
  
  @IsString()
  @ValidateIf(o => o.NODE_ENV === 'production')
  MOODIAN_API_KEY?: string;

  @IsString()
  @ValidateIf(o => o.NODE_ENV === 'production')
  MOODIAN_PRIVATE_KEY?: string;

  // ============================================
  // CORS Configuration
  // ============================================
  
  @IsString()
  CORS_ORIGINS!: string;

  // ============================================
  // Logging & Monitoring
  // ============================================
  
  @IsBoolean()
  @IsOptional()
  DEBUG = false;

  @IsString()
  @IsIn(['error', 'warn', 'info', 'debug', 'verbose'])
  @IsOptional()
  LOG_LEVEL = 'info';

  @IsString()
  @IsOptional()
  API_PREFIX = '/api';

  // ============================================
  // Observability
  // ============================================
  
  @IsString()
  @IsOptional()
  @IsUrl({}, { message: 'JAEGER_ENDPOINT must be a valid URL' })
  JAEGER_ENDPOINT?: string;

  @IsString()
  @IsOptional()
  OTEL_EXPORTER_OTLP_ENDPOINT?: string;

  // ============================================
  // Email Configuration
  // ============================================
  
  @IsString()
  @IsOptional()
  SMTP_HOST?: string;

  @IsOptional()
  SMTP_PORT?: number | string;

  @IsString()
  @ValidateIf(o => o.SMTP_HOST)
  SMTP_USER?: string;

  @IsString()
  @ValidateIf(o => o.SMTP_HOST)
  SMTP_PASSWORD?: string;

  // ============================================
  // SMS Configuration (Kavenegar)
  // ============================================
  
  @IsString()
  @ValidateIf(o => o.NODE_ENV === 'production')
  KAVENEGAR_API_KEY?: string;

  // ============================================
  // Feature Flags (Unleash)
  // ============================================
  
  @IsString()
  @IsOptional()
  @IsUrl({}, { message: 'UNLEASH_URL must be a valid URL' })
  UNLEASH_URL?: string;

  @IsString()
  @ValidateIf(o => o.UNLEASH_URL)
  UNLEASH_API_TOKEN?: string;

  // ============================================
  // Vault Configuration
  // ============================================
  
  @IsString()
  @IsOptional()
  @IsUrl({}, { message: 'VAULT_ADDR must be a valid URL' })
  VAULT_ADDR?: string;

  @IsString()
  @ValidateIf(o => o.VAULT_ADDR)
  VAULT_TOKEN?: string;

  // ============================================
  // Session Configuration
  // ============================================
  
  @IsString()
  @MinLength(32)
  @ValidateIf(o => o.NODE_ENV === 'production')
  SESSION_SECRET?: string;

  // ============================================
  // Rate Limiting
  // ============================================
  
  @IsOptional()
  RATE_LIMIT_TTL?: number | string;

  @IsOptional()
  RATE_LIMIT_MAX?: number | string;

  @IsOptional()
  RATE_LIMIT_AUTH_MAX?: number | string;
}

/**
 * Required secrets for production environment
 */
const PRODUCTION_REQUIRED_SECRETS = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'JWT_PRIVATE_KEY',
  'JWT_PUBLIC_KEY',
  'TOTP_ENCRYPTION_KEY',
  'ZARINPAL_MERCHANT_ID',
  'ZARINPAL_WEBHOOK_SECRET',
  'SESSION_SECRET',
];

/**
 * Validate that all production secrets are present
 */
function validateProductionSecrets(config: Record<string, unknown>): string[] {
  const errors: string[] = [];
  
  if (config.NODE_ENV !== 'production') {
    return errors;
  }

  for (const secret of PRODUCTION_REQUIRED_SECRETS) {
    if (!config[secret]) {
      errors.push(`Missing required production secret: ${secret}`);
    }
  }

  return errors;
}

/**
 * Check for hardcoded/weak secrets
 */
function checkForWeakSecrets(config: Record<string, unknown>): string[] {
  const warnings: string[] = [];
  const weakPatterns = [
    /^secret$/i,
    /^password$/i,
    /^123456/,
    /^test/i,
    /^dev/i,
    /^changeme/i,
    /^default/i,
  ];

  const secretKeys = [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'TOTP_ENCRYPTION_KEY',
    'SESSION_SECRET',
    'ZARINPAL_WEBHOOK_SECRET',
  ];

  for (const key of secretKeys) {
    const value = config[key];
    if (typeof value === 'string') {
      for (const pattern of weakPatterns) {
        if (pattern.test(value)) {
          warnings.push(`Potentially weak secret detected for ${key}`);
          break;
        }
      }
    }
  }

  return warnings;
}

/**
 * Validate environment configuration
 * 
 * Features:
 * - Class-validator based validation
 * - Production-specific secret requirements
 * - Weak secret detection
 * - Fail-fast on missing critical secrets
 */
export function validate(config: Record<string, unknown>) {
  // Handle JWT_SECRET for both production and non-production
  if (config.NODE_ENV !== 'production' && !config.JWT_SECRET) {
    config.JWT_SECRET = config.JWT_SECRET_DEV;
  }
  if (config.NODE_ENV !== 'production' && !config.JWT_REFRESH_SECRET) {
    config.JWT_REFRESH_SECRET = config.JWT_REFRESH_SECRET_DEV;
  }

  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  // Check production secrets
  const productionErrors = validateProductionSecrets(config);
  
  // Check for weak secrets
  const weakSecretWarnings = checkForWeakSecrets(config);

  // Log warnings
  for (const warning of weakSecretWarnings) {
    logger.warn(`?? ${warning}`);
  }

  // Combine all errors
  const allErrors: string[] = [];
  
  if (errors.length > 0) {
    allErrors.push(...errors.map(e => Object.values(e.constraints || {}).join(', ')));
  }
  
  allErrors.push(...productionErrors);

  if (allErrors.length > 0) {
    const errorMessage = `Environment validation failed:\n${allErrors.map(e => `  - ${e}`).join('\n')}`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  logger.log('? Environment validation passed');
  return validatedConfig;
}

/**
 * Get secret from environment or Vault
 * In production, prefer Vault for sensitive secrets
 */
export async function getSecret(key: string): Promise<string | undefined> {
  // First check environment
  const envValue = process.env[key];
  if (envValue) {
    return envValue;
  }

  // In production, could integrate with Vault here
  // const vaultAddr = process.env.VAULT_ADDR;
  // const vaultToken = process.env.VAULT_TOKEN;
  // if (vaultAddr && vaultToken) {
  //   return await fetchFromVault(key);
  // }

  return undefined;
}

/**
 * Export for testing
 */
export const __testing = {
  validateProductionSecrets,
  checkForWeakSecrets,
  PRODUCTION_REQUIRED_SECRETS,
  EnvironmentVariables,
};
