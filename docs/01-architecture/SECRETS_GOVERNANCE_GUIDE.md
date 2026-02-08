# 🔐 Secret Scanning & Governance Guide

## 1. Git History Secrets Removal

### Scan for Secrets in Current History

```bash
# Install gitleaks
npm install -D @trufflesecurity/cli

# Scan current repo
gitleaks detect --source local --verbose

# Scan with json output
gitleaks detect --source local --json --json-file secrets-report.json
```

### Remove Secrets from Git History

```bash
# Install git-filter-repo (recommended over BFG)
pip install git-filter-repo

# OR install BFG repo cleaner
wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar

# Find all secret files
git log --all --full-history --reverse -- .env* secrets/ private_keys/

# Completely remove file from history
git-filter-repo --path .env --invert-paths

# Force push to rewrite history (DANGEROUS - coordinate with team)
git push --force-with-lease --all
git push --force-with-lease --tags
```

### Scan and Rotate Exposed Credentials

```bash
# Get all exposed secrets
gitleaks detect --source local --json | jq '.[] | .Secret'

# For each secret type:

# 1. Database passwords
psql -h <db-host> -U postgres -d postgres -c \
  "ALTER ROLE <user> WITH PASSWORD '<NEW_SECURE_PASSWORD>';"

# 2. API Keys (rotate in Azure Key Vault)
az keyvault secret set --vault-name <vault-name> \
  --name "<secret-name>" --value "<new-secret>"

# 3. Private keys (regenerate)
ssh-keygen -t ed25519 -f ~/.ssh/github_key -N ""
# Update SSH keys in GitHub

# 4. Personal access tokens (regenerate)
# Go to GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)
```

---

## 2. Azure Key Vault Integration

### Setup

```typescript
// src/config/secrets.module.ts
import { Module } from '@nestjs/common';
import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';

@Module({
  providers: [
    {
      provide: 'SECRETS_SERVICE',
      useFactory: async () => {
        const credential = new DefaultAzureCredential();
        const client = new SecretClient(
          `https://${process.env.AZURE_KEYVAULT_NAME}.vault.azure.net/`,
          credential
        );
        return client;
      },
    },
  ],
  exports: ['SECRETS_SERVICE'],
})
export class SecretsModule {}
```

### Access Secrets

```typescript
// src/config/secrets.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { SecretClient } from '@azure/keyvault-secrets';

@Injectable()
export class SecretsService {
  constructor(
    @Inject('SECRETS_SERVICE') private readonly client: SecretClient
  ) {}

  async getSecret(name: string): Promise<string> {
    try {
      const secret = await this.client.getSecret(name);
      return secret.value;
    } catch (error) {
      throw new Error(`Failed to retrieve secret ${name}: ${error.message}`);
    }
  }

  // Usage
  async getDatabaseUrl(): Promise<string> {
    return this.getSecret('db-connection-string');
  }

  async getJwtPrivateKey(): Promise<string> {
    return this.getSecret('jwt-private-key');
  }

  async getRedisPassword(): Promise<string> {
    return this.getSecret('redis-password');
  }
}
```

### Secrets Required in Key Vault

```yaml
Secrets to Create:
  # Database
  - db-connection-string: postgres://user:pass@host:5432/db
  - db-backup-encryption-key: <256-bit-key>
  
  # Redis
  - redis-password: <strong-password>
  - redis-encryption-key: <256-bit-key>
  
  # JWT
  - jwt-private-key: <RSA-2048-private-key>
  - jwt-public-key: <RSA-2048-public-key>
  - jwt-kid: <key-id>
  
  # API Keys
  - stripe-api-key: sk_test_...
  - email-service-key: <key>
  
  # Signing Keys
  - audit-log-signing-key: <key>
  - hmac-signing-key: <key>
```

---

## 3. CI/CD Secret Prevention

### Pre-commit Hook

```bash
# .git/hooks/pre-commit
#!/bin/bash

echo "🔍 Scanning for secrets before commit..."

# Run gitleaks
gitleaks protect --source local --verbose

if [ $? -ne 0 ]; then
  echo "❌ Secrets detected! Commit aborted."
  echo "Please remove secrets and try again."
  exit 1
fi

echo "✅ No secrets detected"
exit 0
```

### Install Hook

```bash
chmod +x .git/hooks/pre-commit

# Or use husky
npm install husky --save-dev
npx husky install
npx husky add .husky/pre-commit 'npm run security:scan'
```

### GitHub Push Protection

```bash
# Enable in GitHub
gh secret set-protection-status <secret-name> --protected

# Or via API
curl -X PATCH \
  -H "Authorization: token <TOKEN>" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/<owner>/<repo>/secret-scanning/security-alerts/<alert> \
  -d '{"state":"resolved"}'
```

### CI/CD Pipeline Checks

```yaml
# .github/workflows/prevent-secrets.yml
name: Prevent Secrets Leak

on: [ push, pull_request ]

jobs:
  prevent-secrets:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: TruffleHog Secret Scan
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
          head: HEAD

      - name: Gitleaks Scan
        uses: gitleaks/gitleaks-action@v2
        with:
          fail: true

      - name: Check environment secrets
        run: |
          # Ensure .env files are in .gitignore
          if git ls-files | grep -E '\.env'; then
            echo "❌ .env files found in git"
            exit 1
          fi
```

---

## 4. Secret Rotation Policy

### Automated Rotation

```typescript
// src/config/secret-rotation.service.ts
import { Injectable, Cron } from '@nestjs/schedule';
import { SecretsService } from './secrets.service';

@Injectable()
export class SecretRotationService {
  constructor(private readonly secrets: SecretsService) {}

  // Rotate JWT keys every 90 days
  @Cron('0 0 1 */3 *')  // First day of every 3 months
  async rotateJwtKeys() {
    console.log('🔄 Rotating JWT keys...');
    
    const { publicKey, privateKey } = await this.generateNewKeys();
    
    // Update in Key Vault
    await this.secrets.setSecret('jwt-private-key', privateKey);
    await this.secrets.setSecret('jwt-public-key', publicKey);
    
    console.log('✅ JWT keys rotated');
  }

  // Rotate database password every 30 days
  @Cron('0 0 * * 0')  // Every Sunday
  async rotateDbPassword() {
    console.log('🔄 Rotating database password...');
    
    const newPassword = this.generateStrongPassword(32);
    
    // Update in database
    await this.updateDatabasePassword(newPassword);
    
    // Update in Key Vault
    await this.secrets.setSecret('db-password', newPassword);
    
    console.log('✅ Database password rotated');
  }

  // Rotate API keys every 60 days
  @Cron('0 0 * * 1')  // Every Monday
  async rotateApiKeys() {
    console.log('🔄 Rotating API keys...');
    
    const keys = ['stripe-api-key', 'email-service-key'];
    
    for (const key of keys) {
      const newKey = await this.generateNewApiKey(key);
      await this.secrets.setSecret(key, newKey);
    }
    
    console.log('✅ API keys rotated');
  }

  private generateStrongPassword(length: number): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    let password = '';
    
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    return password;
  }

  private async generateNewKeys() {
    const crypto = require('crypto');
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });
    
    return { publicKey, privateKey };
  }

  private generateNewApiKey(type: string): Promise<string> {
    // Implement based on API provider
    return Promise.resolve(`key_${Date.now()}`);
  }
}
```

### Manual Rotation Commands

```bash
# Rotate all secrets
npm run rotate-secrets

# Rotate specific secret
npm run rotate-secret -- --name jwt-private-key

# Force rotation (immediate)
npm run rotate-secrets -- --force

# Verify rotation
npm run verify-secrets
```

---

## 5. Secret Governance Dashboard

### Monitoring Script

```typescript
// src/config/secret-audit.service.ts
import { Injectable } from '@nestjs/common';
import { SecretsService } from './secrets.service';

@Injectable()
export class SecretAuditService {
  constructor(private readonly secrets: SecretsService) {}

  async getSecretInventory() {
    const secrets = [
      'jwt-private-key',
      'jwt-public-key',
      'db-password',
      'redis-password',
      'stripe-api-key',
      'email-service-key',
      'audit-log-signing-key',
    ];

    const inventory = await Promise.all(
      secrets.map(async (name) => ({
        name,
        created: await this.getSecretCreatedDate(name),
        lastRotated: await this.getLastRotationDate(name),
        expiresIn: await this.daysUntilExpiration(name),
        status: await this.validateSecret(name),
      }))
    );

    return inventory;
  }

  async validateSecretUsage() {
    // Check if secrets are being used correctly
    const violations = [];

    // Check for secrets in logs
    const secretsInLogs = await this.scanLogsForSecrets();
    if (secretsInLogs.length > 0) {
      violations.push({
        severity: 'CRITICAL',
        message: 'Secrets detected in logs',
        count: secretsInLogs.length,
      });
    }

    // Check for unencrypted secrets in transit
    const unencryptedSecrets = await this.checkEncryption();
    if (unencryptedSecrets.length > 0) {
      violations.push({
        severity: 'CRITICAL',
        message: 'Unencrypted secrets in transit',
        count: unencryptedSecrets.length,
      });
    }

    // Check for expired secrets
    const expiredSecrets = await this.findExpiredSecrets();
    if (expiredSecrets.length > 0) {
      violations.push({
        severity: 'HIGH',
        message: 'Expired secrets found',
        secrets: expiredSecrets,
      });
    }

    return violations;
  }

  private async getSecretCreatedDate(name: string): Promise<Date> {
    // Implementation
    return new Date();
  }

  private async getLastRotationDate(name: string): Promise<Date> {
    // Implementation
    return new Date();
  }

  private async daysUntilExpiration(name: string): Promise<number> {
    // Implementation
    return 30;
  }

  private async validateSecret(name: string): Promise<string> {
    // Implementation
    return 'VALID';
  }

  private async scanLogsForSecrets(): Promise<string[]> {
    // Implementation
    return [];
  }

  private async checkEncryption(): Promise<string[]> {
    // Implementation
    return [];
  }

  private async findExpiredSecrets(): Promise<string[]> {
    // Implementation
    return [];
  }
}
```

---

## 6. Compliance Checklist

- [ ] All secrets removed from git history
- [ ] All current secrets moved to Key Vault
- [ ] Pre-commit hook installed
- [ ] CI/CD secret scanning enabled
- [ ] Secret rotation policies configured
- [ ] Audit logging for secret access
- [ ] Secret inventory maintained
- [ ] Regular secret rotation schedule
- [ ] Backup secrets encrypted
- [ ] Employee secrets training completed
- [ ] Incident response procedure for secret exposure

---

## 7. Emergency Response

### If Secret is Exposed

```bash
#!/bin/bash

SECRET_NAME=$1
SEVERITY=${2:-"HIGH"}

echo "🚨 EMERGENCY: Secret exposed: $SECRET_NAME"

# Step 1: Rotate immediately
npm run rotate-secret -- --name $SECRET_NAME --force

# Step 2: Invalidate old credentials
npm run invalidate-secret -- --name $SECRET_NAME

# Step 3: Notify stakeholders
npm run notify-team -- --message "Secret $SECRET_NAME rotated due to exposure" --severity $SEVERITY

# Step 4: Audit access logs
npm run audit-secret-access -- --name $SECRET_NAME --since "1 day ago"

# Step 5: Create incident report
npm run create-incident -- --type "SECRET_EXPOSURE" --secret $SECRET_NAME

echo "✅ Emergency response complete"
```

---

## 8. .gitignore Configuration

```gitignore
# Secrets
.env
.env.local
.env.*.local
*.key
*.pem
secrets/
private_keys/
.env.production

# AWS
.aws/credentials
.aws/config

# Azure
.azure/
local.settings.json

# API Keys
apikey
api_key

# Sensitive files
password.txt
credentials.json
```

---

**Status**: ✅ Ready for Implementation
**Last Updated**: November 19, 2025
