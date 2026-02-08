# 🛡️ Iron Dome CI/CD Pipeline - Complete Guide

## Overview

Military-grade CI/CD pipeline with zero-tolerance for broken code.

---

## 🏗️ Architecture

```
Pull Request → CI Checks → Code Review → Merge to Main → CD Deploy → Production
     ↓              ↓            ↓            ↓              ↓            ↓
  Gatekeeper    Tests      CODEOWNERS    Build Image    SSH Deploy   Health Check
```

---

## 📋 Workflows

### 1. CI Pipeline (`ci.yml`)

**Trigger**: Pull Request to `main` / `develop`  
**Purpose**: Prevent broken code from merging

**Jobs**:
1. ? Lint & format check
2. ? Type check
3. ? Security scan (Trivy + pnpm audit + Gitleaks)
4. ? Unit tests + coverage
5. ? Property-based tests
6. ? Build
7. ? CodeQL analysis
8. ? Integration tests (PRs to main only)

**Concurrency**: Cancels outdated runs on same PR

**Example**:
```bash
# Triggered automatically on PR
# View status: GitHub PR checks
```

---

### 2. Production Deploy (`deploy-production.yml`)

**Trigger**: Push to `main` (after CI passes)  
**Purpose**: Automated zero-downtime deployment

**Jobs**:

#### Job 1: Build & Push
- Login to GHCR
- Build Docker image
- Tag with SHA + latest
- Push to registry

#### Job 2: Deploy
- SSH to production server
- Pull latest image
- Run Prisma migrations
- Zero-downtime restart
- Health check verification
- Cleanup old images

**Example**:
```bash
# Triggered automatically on merge to main
# Manual trigger: GitHub Actions → Deploy to Production → Run workflow
```

---

### 3. Security Scan (`security-scan.yml`)

**Trigger**: Weekly (Monday 2 AM) + Manual  
**Purpose**: Continuous security monitoring

**Jobs**:
1. Trivy container scan
2. Dependency audit
3. Upload SARIF results

**Example**:
```bash
# Runs automatically every Monday
# Manual trigger: GitHub Actions → Security Scan → Run workflow
```

---

### 4. Emergency Rollback (ollback.yml`)

**Trigger**: Manual only  
**Purpose**: Quick rollback to previous version

**Input**: Commit SHA to rollback to

**Example**:
```bash
# GitHub Actions → Emergency Rollback → Run workflow
# Input: abc123def (commit SHA)
```

---

## 🔒 Security Features

### Dependabot (`dependabot.yml`)

**Schedule**: Weekly (Monday 9 AM)  
**Targets**:
- NPM dependencies
- Docker base images
- GitHub Actions

**Limits**:
- Max 10 NPM PRs
- Max 5 Docker PRs
- Max 5 Actions PRs

**Auto-ignore**: Major version updates (manual review required)

---

### Code Owners (`CODEOWNERS`)

**Protected Files**:
- `/libs/core/src/finance.ts` - Financial engine
- `/prisma/schema.prisma` - Database schema
- `/.github/workflows/` - CI/CD pipelines
- `/Dockerfile*` - Container configs
- `/apps/api/src/order/` - Order processing

**Effect**: Requires owner approval for changes

---

## 🚀 Setup Instructions

### 1. GitHub Secrets

Configure these secrets in GitHub repository settings:

```
Settings → Secrets and variables → Actions → New repository secret
```

**Required Secrets**:
```
SERVER_HOST=your-server-ip
SERVER_USER=deploy
SSH_PRIVATE_KEY=<your-ssh-private-key>
SERVER_PORT=22 (optional, defaults to 22)
```

**Generate SSH Key**:
```bash
ssh-keygen -t ed25519 -C "github-actions-deploy"
# Copy private key to GitHub secret: SSH_PRIVATE_KEY
# Copy public key to server: ~/.ssh/authorized_keys
```

---

### 2. Server Preparation

**On Production Server**:
```bash
# Create deployment directory
sudo mkdir -p /opt/nextgen-market
sudo chown deploy:deploy /opt/nextgen-market

# Clone repository
cd /opt/nextgen-market
git clone https://github.com/your-org/nextgen-market.git .

# Configure environment
cp .env.production.example .env.production
nano .env.production  # Add secrets

# Initial deployment
bash deploy.sh
```

---

### 3. Enable Branch Protection

**GitHub Settings → Branches → Add rule**:

**Branch name pattern**: `main`

**Rules**:
- ✅ Require a pull request before merging
- ✅ Require approvals (1)
- ✅ Require status checks to pass
  - ? CI Pipeline / Lint & Type Check
  - ? CI Pipeline / Security Scan
  - ? CI Pipeline / Unit Tests
  - ? CI Pipeline / Property-Based Tests
  - ? CI Pipeline / Build
  - ? CI Pipeline / CodeQL Analysis
  - ? CI Pipeline / Integration Tests (PRs to main)
- ✅ Require branches to be up to date
- ✅ Require conversation resolution
- ✅ Include administrators

---

## 📊 Workflow Status

### View Workflow Runs
```
GitHub → Actions → Select workflow → View runs
```

### Check Deployment Status
```bash
# SSH to server
ssh deploy@your-server

# Check containers
docker ps

# View logs
docker logs -f nextgen-api
docker logs -f nextgen-web

# Run health check
bash health-check.sh
```

---

## 🔄 Common Operations

### Deploy to Production
```bash
# 1. Create PR
git checkout -b feature/my-feature
git commit -m "feat: add new feature"
git push origin feature/my-feature

# 2. Open PR on GitHub
# 3. Wait for CI checks to pass
# 4. Get approval from code owner
# 5. Merge to main
# 6. CD pipeline deploys automatically
```

### Emergency Rollback
```bash
# 1. Find commit SHA to rollback to
git log --oneline

# 2. GitHub Actions → Emergency Rollback
# 3. Input commit SHA
# 4. Run workflow
# 5. Verify deployment
```

### Manual Deployment
```bash
# GitHub Actions → Deploy to Production
# Click "Run workflow"
# Select branch: main
# Click "Run workflow"
```

---

## 🎯 Success Criteria

### CI Pipeline
- ✅ All tests pass
- ✅ No lint errors
- ✅ No type errors
- ✅ No high/critical vulnerabilities
- ✅ Financial engine tests pass

### CD Pipeline
- ✅ Docker image built successfully
- ✅ Image pushed to GHCR
- ✅ Migrations applied
- ✅ Containers restarted
- ✅ Health checks pass
- ✅ Old images cleaned up

---

## 🚨 Troubleshooting

### CI Checks Failing

**Problem**: Tests fail  
**Solution**: Fix tests locally, push changes

**Problem**: Lint errors  
**Solution**: Run `npm run lint -- --fix`

**Problem**: Type errors  
**Solution**: Run `npx tsc --noEmit`, fix errors

### CD Deployment Failing

**Problem**: SSH connection failed  
**Solution**: Verify `SSH_PRIVATE_KEY` secret

**Problem**: Docker build failed  
**Solution**: Check Dockerfile syntax

**Problem**: Health check failed  
**Solution**: SSH to server, check logs

### Rollback Needed

**Problem**: Production broken after deploy  
**Solution**: Run Emergency Rollback workflow

---

## 📈 Metrics

### Pipeline Performance
- CI Duration: ~3-5 minutes
- CD Duration: ~5-10 minutes
- Total Deploy Time: ~8-15 minutes

### Success Rate Target
- CI Pass Rate: >95%
- CD Success Rate: >98%
- Rollback Time: <5 minutes

---

## 🎓 Best Practices

1. ✅ Always create PR for changes
2. ✅ Wait for CI checks before requesting review
3. ✅ Get code owner approval for critical files
4. ✅ Test locally before pushing
5. ✅ Write tests for new features
6. ✅ Update documentation
7. ✅ Monitor deployment logs
8. ✅ Verify health checks after deploy

---

## 📞 Support

**CI/CD Issues**: Check GitHub Actions logs  
**Deployment Issues**: SSH to server, check logs  
**Security Issues**: Review Dependabot PRs  
**Emergency**: Run rollback workflow

---

**Status**: ✅ IRON DOME ACTIVE  
**Protection Level**: MILITARY-GRADE  
**Zero Downtime**: GUARANTEED



