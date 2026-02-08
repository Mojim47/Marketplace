# 🧠 Enterprise-SERTA Security Analyzer

**Simple, Fast, and Effective Security Analysis for NextGen Marketplace**

## Quick Start

```bash
# Install dependencies
cd enterprise-serta
pnpm install

# Build the analyzer
pnpm run build

# Analyze NextGen Marketplace
pnpm run analyze:nextgen

# Or analyze any project
pnpm run analyze /path/to/project
```

## What It Does

This tool analyzes your codebase for:

- **🔐 Hardcoded Secrets**: API keys, passwords, tokens
- **💉 SQL Injection**: Unsafe database queries
- **🚫 Missing Auth Guards**: Unprotected endpoints
- **🏢 Tenant Isolation**: Multi-tenant security issues
- **💰 Payment Security**: ZarinPal and financial vulnerabilities
- **📋 Compliance Issues**: Moodian and Iranian regulations

## Sample Output

```
📊 Analysis Results
══════════════════════════════════════════════════
Project: /path/to/nextgen-marketplace
Files Analyzed: 1,247
Risk Score: 7.2/10

🚨 Security Findings
Critical: 12
High: 34
Medium: 67
Low: 23

🔍 Top Findings:
1. HARDCODED_SECRET in apps/api/src/auth/auth.service.ts:15
   Hardcoded secret or credential detected
2. TENANT_ISOLATION_BYPASS in apps/api/src/order/order.service.ts:45
   Database query missing tenant isolation
3. MISSING_AUTH in apps/api/src/product/product.controller.ts:23
   Endpoint missing authentication guard
```

## Features

✅ **Fast Analysis**: Scans 1000+ files in seconds  
✅ **NextGen Specific**: Tailored for Iranian marketplace patterns  
✅ **Zero Dependencies**: Minimal setup required  
✅ **Actionable Results**: Clear recommendations for each finding  
✅ **JSON Output**: Machine-readable results for CI/CD  

## Requirements

- Node.js 18+
- TypeScript project

## License

MIT