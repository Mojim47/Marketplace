import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SecretsService {
  private readonly logger = new Logger(SecretsService.name);

  getSecret(key: string): string | undefined {
    return process.env[key];
  }

  getSecretOrThrow(key: string): string {
    const value = process.env[key];
    if (!value) {
      this.logger.error(`Missing required secret: ${key}`);
      throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
  }

  getDatabaseUrl(): string {
    return this.getSecretOrThrow('DATABASE_URL');
  }

  getJwtSecret(): string {
    return this.getSecretOrThrow('JWT_SECRET');
  }

  getRedisUrl(): string {
    return this.getSecretOrThrow('REDIS_URL');
  }
}
