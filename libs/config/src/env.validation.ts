import fs from 'node:fs';
import path from 'node:path';
import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

type ServiceType = 'api' | 'worker' | 'web' | 'admin' | 'generic';

interface ValidateEnvOptions {
  env?: NodeJS.ProcessEnv | Record<string, unknown>;
  service?: ServiceType;
  exitOnError?: boolean;
}

interface LoadEnvOptions {
  cwd?: string;
  allowProduction?: boolean;
  explicitFiles?: string[];
}

const DEFAULT_NODE_ENV = 'development';

function isProdLike(nodeEnv: string): boolean {
  return nodeEnv === 'production' || nodeEnv === 'staging';
}

export function loadEnvFiles(options: LoadEnvOptions = {}): string[] {
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = DEFAULT_NODE_ENV;
  }
  const nodeEnv = (process.env.NODE_ENV || DEFAULT_NODE_ENV).trim();
  const allowProduction = options.allowProduction ?? process.env.ALLOW_ENV_FILE_IN_PROD === 'true';
  const shouldLoad = !isProdLike(nodeEnv) || allowProduction;

  if (!shouldLoad) {
    return [];
  }

  const cwd = options.cwd || process.cwd();
  const defaultFiles = [
    path.join(cwd, '.env'),
    path.join(cwd, '.env.local'),
    path.join(cwd, `.env.${nodeEnv}`),
    path.join(cwd, `.env.${nodeEnv}.local`),
  ];
  const files = options.explicitFiles || defaultFiles;

  const loaded: string[] = [];
  for (const file of files) {
    if (!file || !fs.existsSync(file)) {
      continue;
    }
    const result = dotenvConfig({ path: file, override: true });
    if (result.error) {
      continue;
    }
    loaded.push(file);
  }

  return loaded;
}

const baseSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'staging', 'production']),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    REDIS_URL: z.string().optional(),
    KEYDB_URL: z.string().optional(),
  })
  .refine((data) => Boolean(data.REDIS_URL || data.KEYDB_URL), {
    message: 'REDIS_URL or KEYDB_URL is required',
    path: ['REDIS_URL'],
  });

const apiCommonSchema = z.object({
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
});

const apiProdSchema = apiCommonSchema.extend({
  JWT_SECRET: z.string().min(64, 'JWT_SECRET must be at least 64 characters'),
  JWT_REFRESH_SECRET: z.string().min(64, 'JWT_REFRESH_SECRET must be at least 64 characters'),
  JWT_PRIVATE_KEY: z
    .string()
    .regex(/^-----BEGIN (RSA )?PRIVATE KEY-----/, 'JWT_PRIVATE_KEY must be PEM'),
  JWT_PUBLIC_KEY: z
    .string()
    .regex(/^-----BEGIN (RSA )?PUBLIC KEY-----/, 'JWT_PUBLIC_KEY must be PEM'),
  TOTP_ENCRYPTION_KEY: z.string().min(32, 'TOTP_ENCRYPTION_KEY must be at least 32 characters'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  ZARINPAL_MERCHANT_ID: z.string().min(36, 'ZARINPAL_MERCHANT_ID must be at least 36 characters'),
  ZARINPAL_WEBHOOK_SECRET: z
    .string()
    .min(32, 'ZARINPAL_WEBHOOK_SECRET must be at least 32 characters'),
  CORS_ORIGINS: z.string().min(1, 'CORS_ORIGINS is required in production'),
});

export const envSchema = baseSchema.and(apiCommonSchema.partial());

export type EnvConfig = z.infer<typeof envSchema>;

export function parseEnv(env: NodeJS.ProcessEnv | Record<string, unknown> = process.env) {
  return envSchema.safeParse(env);
}

function getServiceSchema(env: NodeJS.ProcessEnv | Record<string, unknown>, service: ServiceType) {
  const nodeEnv = String((env as Record<string, unknown>).NODE_ENV || DEFAULT_NODE_ENV);
  const isProd = isProdLike(nodeEnv);

  if (service === 'api') {
    return baseSchema.and(isProd ? apiProdSchema : apiCommonSchema);
  }
  if (service === 'worker') {
    return baseSchema;
  }

  return baseSchema;
}

export function validateEnv(options: ValidateEnvOptions = {}): EnvConfig {
  const env = options.env || process.env;
  const service: ServiceType = options.service || 'generic';
  const exitOnError = options.exitOnError !== false;

  const result = parseEnv(env);
  const serviceSchema = getServiceSchema(env, service);
  const serviceResult = serviceSchema.safeParse(env);

  if (!result.success || !serviceResult.success) {
    console.error('Environment validation failed. Fix the following errors:');
    const issues = [
      ...(result.success ? [] : result.error.issues),
      ...(serviceResult.success ? [] : serviceResult.error.issues),
    ];
    for (const issue of issues) {
      console.error(`- ${issue.path.join('.')}: ${issue.message}`);
    }
    if (exitOnError) {
      process.exit(1);
    }
  }

  return (serviceResult.success ? serviceResult.data : result.data) as EnvConfig;
}

export class EnvironmentValidationService {
  constructor(private readonly service: ServiceType = 'generic') {}

  validateAtStartup(): {
    success: boolean;
    warnings?: Array<{ field: string; message: string; recommendation?: string }>;
  } {
    const schema = getServiceSchema(process.env, this.service);
    const result = schema.safeParse(process.env);
    if (result.success) {
      return { success: true, warnings: [] };
    }

    return {
      success: false,
      warnings: [],
    };
  }

  generateValidationReport(): string {
    const schema = getServiceSchema(process.env, this.service);
    const result = schema.safeParse(process.env);
    if (result.success) {
      return 'Environment validation passed.';
    }

    return result.error.issues
      .map((issue) => `- ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
  }
}
