#!/usr/bin/env ts-node
// ═══════════════════════════════════════════════════════════════════════════
// Production Secrets Generator
// ═══════════════════════════════════════════════════════════════════════════
// Generates cryptographically secure secrets for production deployment
// ═══════════════════════════════════════════════════════════════════════════

import { randomBytes, createHash } from 'crypto';
import { writeFileSync } from 'fs';

interface ProductionSecrets {
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  USER_HASH_SALT: string;
  DATABASE_PASSWORD: string;
  REDIS_PASSWORD: string;
  GRAFANA_ADMIN_PASSWORD: string;
  CLICKHOUSE_PASSWORD: string;
  SMTP_PASSWORD: string;
}

function generateSecureSecret(length: number = 64): string {
  return randomBytes(length).toString('base64url');
}

function generatePassword(length: number = 32): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }
  
  return password;
}

function generateProductionSecrets(): ProductionSecrets {
  console.log('🔐 Generating production secrets...');
  
  const secrets: ProductionSecrets = {
    JWT_SECRET: generateSecureSecret(64),
    JWT_REFRESH_SECRET: generateSecureSecret(64),
    USER_HASH_SALT: generateSecureSecret(32),
    DATABASE_PASSWORD: generatePassword(32),
    REDIS_PASSWORD: generatePassword(24),
    GRAFANA_ADMIN_PASSWORD: generatePassword(20),
    CLICKHOUSE_PASSWORD: generatePassword(24),
    SMTP_PASSWORD: generatePassword(24),
  };

  return secrets;
}

function createProductionEnvFile(secrets: ProductionSecrets): void {
  const envContent = `# ═══════════════════════════════════════════════════════════════════════════
# NextGen Marketplace - Production Environment Configuration
# ═══════════════════════════════════════════════════════════════════════════
# 🚨 CRITICAL: This file contains production secrets - NEVER commit to git
# Generated on: ${new Date().toISOString()}
# ═══════════════════════════════════════════════════════════════════════════

# Application Configuration
NODE_ENV=production
PORT=3001
API_VERSION=v3
HOST=0.0.0.0

# Database Configuration
DATABASE_URL=postgresql://nextgen:${secrets.DATABASE_PASSWORD}@localhost:5432/nextgen_marketplace?schema=public
DB_USER=nextgen
DB_PASSWORD=${secrets.DATABASE_PASSWORD}
DB_NAME=nextgen_marketplace
POSTGRES_PORT=5432

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=${secrets.REDIS_PASSWORD}
REDIS_DB=0
REDIS_URL=redis://:${secrets.REDIS_PASSWORD}@localhost:6379

# JWT Configuration
JWT_SECRET=${secrets.JWT_SECRET}
JWT_REFRESH_SECRET=${secrets.JWT_REFRESH_SECRET}
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# 2FA Configuration
TOTP_ISSUER=NextGen Marketplace
TOTP_ALGORITHM=sha1
TOTP_DIGITS=6
TOTP_PERIOD=30

# ZarinPal Payment Gateway (MUST BE CONFIGURED)
ZARINPAL_MERCHANT_ID=CONFIGURE_WITH_REAL_MERCHANT_ID
ZARINPAL_SANDBOX=false
ZARINPAL_CALLBACK_URL=https://your-domain.com/api/v3/payments/zarinpal/callback

# Moodian Tax Authority (MUST BE CONFIGURED)
MOODIAN_CLIENT_ID=CONFIGURE_WITH_REAL_CLIENT_ID
MOODIAN_CLIENT_SECRET=CONFIGURE_WITH_REAL_CLIENT_SECRET
MOODIAN_BASE_URL=https://api.moodian.ir
MOODIAN_TAX_ID=CONFIGURE_WITH_REAL_TAX_ID

# ClickHouse Analytics
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_DATABASE=nextgen_analytics
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=${secrets.CLICKHOUSE_PASSWORD}

# S3 Storage (MUST BE CONFIGURED)
S3_BUCKET_NAME=nextgen-marketplace-prod
S3_REGION=us-east-1
S3_ENDPOINT=
AWS_ACCESS_KEY_ID=CONFIGURE_WITH_REAL_ACCESS_KEY
AWS_SECRET_ACCESS_KEY=CONFIGURE_WITH_REAL_SECRET_KEY

# SMTP Configuration (MUST BE CONFIGURED)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASSWORD=${secrets.SMTP_PASSWORD}
SMTP_FROM=NextGen Marketplace <noreply@example.com>

# SMS Configuration (MUST BE CONFIGURED)
SMS_API_KEY=CONFIGURE_WITH_REAL_API_KEY
SMS_SENDER=10008663

# Security Configuration
USER_HASH_SALT=${secrets.USER_HASH_SALT}
CORS_ORIGINS=https://your-domain.com,https://admin.your-domain.com

# Rate Limiting
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100
RATE_LIMIT_AUTH_MAX=5
RATE_LIMIT_GLOBAL=1000
RATE_LIMIT_INVENTORY=100
RATE_LIMIT_BIDDING=50
RATE_LIMIT_BULK=10

# Validation Configuration
VALIDATION_MAX_STRING_LENGTH=10000
VALIDATION_MAX_ARRAY_LENGTH=1000
VALIDATION_MAX_OBJECT_DEPTH=10

# Performance Monitoring
SLOW_QUERY_THRESHOLD=1000
ENABLE_QUERY_LOGGING=false

# Cache Configuration
CACHE_TTL_DEFAULT=3600
CACHE_TTL_PRODUCTS=1800
CACHE_TTL_USERS=7200
CACHE_TTL_ORDERS=300

# Analytics Configuration
ANALYTICS_DAILY_EVENT_LIMIT=100000
ENABLE_EMAIL_ALERTS=true

# Monitoring
PROMETHEUS_PORT=9090
GRAFANA_PORT=3000
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=${secrets.GRAFANA_ADMIN_PASSWORD}

# Company Information (MUST BE CONFIGURED)
COMPANY_NAME=NextGen Marketplace
COMPANY_TAX_ID=CONFIGURE_WITH_REAL_TAX_ID
COMPANY_ECONOMIC_CODE=CONFIGURE_WITH_REAL_ECONOMIC_CODE
COMPANY_POSTAL_CODE=CONFIGURE_WITH_REAL_POSTAL_CODE
COMPANY_ADDRESS=CONFIGURE_WITH_REAL_ADDRESS
COMPANY_PHONE=CONFIGURE_WITH_REAL_PHONE
`;

  writeFileSync('.env.production', envContent);
  console.log('✅ Production .env file created: .env.production');
}

function displaySecrets(secrets: ProductionSecrets): void {
  console.log('\n🔐 Generated Production Secrets:');
  console.log('═══════════════════════════════════════════════════════════════');
  
  Object.entries(secrets).forEach(([key, value]) => {
    console.log(`${key}: ${value.substring(0, 8)}...${value.substring(value.length - 8)}`);
  });
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('\n🚨 IMPORTANT SECURITY NOTES:');
  console.log('1. Store these secrets securely (use a password manager)');
  console.log('2. Never commit .env.production to git');
  console.log('3. Use environment-specific secret management in production');
  console.log('4. Rotate secrets regularly');
  console.log('5. Configure remaining secrets marked with "CONFIGURE_WITH_REAL_*"');
  console.log('\n✅ Secrets generated successfully!');
}

function main(): void {
  try {
    console.log('🚀 NextGen Marketplace - Production Secrets Generator');
    console.log('═══════════════════════════════════════════════════════════════');
    
    const secrets = generateProductionSecrets();
    createProductionEnvFile(secrets);
    displaySecrets(secrets);
    
    console.log('\n🎯 Next Steps:');
    console.log('1. Review .env.production file');
    console.log('2. Configure external service credentials');
    console.log('3. Test all services with new secrets');
    console.log('4. Deploy to production environment');
    
  } catch (error) {
    console.error('❌ Error generating secrets:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

export { generateProductionSecrets, ProductionSecrets };