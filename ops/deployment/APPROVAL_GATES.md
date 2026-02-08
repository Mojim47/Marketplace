# GitHub Branch Protection Rules Configuration

## Overview

This document defines the branch protection rules for the NextGen Market repository to enforce code quality, security, and deployment safety across all environments.

## Rule 1: Main Branch (Staging) Protection

**Branch Pattern**: `main`  
**Status**: ✅ ACTIVE  
**Purpose**: Enforce code quality and governance for staging deployments

### Require Pull Request Reviews

```yaml
Minimum number of approvals required: 1

Code Review Requirements:
  ├─ Dismiss stale pull request approvals when new commits are pushed
  │   └─ Status: ENABLED
  ├─ Require approval of the most recent reviewable push
  │   └─ Status: ENABLED
  └─ Require code owners' review
      └─ Status: ENABLED (CODEOWNERS file enforced)

Reviewing Teams:
  ├─ @nextgen-market/core-team (all PRs)
  ├─ @nextgen-market/domain-team (domain/* changes)
  ├─ @nextgen-market/devops-team (infrastructure changes)
  └─ @nextgen-market/security-team (security changes)
```

### Require Status Checks to Pass

```yaml
Status Checks:
  Required (must pass before merge):
    ├─ lint (GitHub Actions)
    │   └─ ESLint + TypeScript + SonarQube
    ├─ test (GitHub Actions)
    │   └─ Unit + Integration tests (coverage > 80%)
    ├─ security (GitHub Actions)
    │   └─ Trivy scan + npm audit
    ├─ build (GitHub Actions)
    │   └─ Docker build + Semantic versioning
    └─ SonarQube/SARIF upload
        └─ Code quality gate

  Optional (informational):
    └─ CodeQL analysis (GitHub Advanced Security)

Strict Status Checks:
  Status: ENABLED
  Behavior: Require status checks to be up to date before merging
  └─ Automatically dismiss old reviews if new commits added
```

### Additional Protection

```yaml
Require Branches to be up to Date Before Merging:
  Status: ENABLED
  └─ Must be rebased or merged with main before deployment

Require Code Owner Review:
  Status: ENABLED
  File: .github/CODEOWNERS
  └─ Enforces domain-specific review requirements

Require Conversation Resolution:
  Status: ENABLED
  └─ All comments must be resolved before merge

Require Signed Commits:
  Status: ENABLED
  └─ Commits must be GPG/SSH signed

Restrict Who Can Push to Matching Branches:
  Status: DISABLED (use for emergency hotfixes only)

Allow Force Pushes:
  Status: DISABLED
  └─ Prevent history rewriting

Allow Deletions:
  Status: DISABLED
  └─ Prevent accidental branch deletion

Allow Auto Merge:
  Status: DISABLED
  └─ Require explicit approval before merge
```

## Rule 2: Develop Branch (Development) Protection

**Branch Pattern**: `develop`  
**Status**: ✅ ACTIVE  
**Purpose**: Enforce code standards for development environment

### Require Pull Request Reviews

```yaml
Minimum number of approvals required: 0 (Fast track for dev)

Code Review Requirements:
  ├─ Dismiss stale pull request approvals
  │   └─ Status: ENABLED
  └─ Require code owners' review
      └─ Status: DISABLED (faster iteration)
```

### Require Status Checks to Pass

```yaml
Required Status Checks:
  ├─ lint (must pass)
  ├─ test (must pass)
  ├─ build (must pass)
  └─ security (informational)

Strict Status Checks: ENABLED
```

## Rule 3: Version Tag Protection

**Tag Pattern**: `v*` (semantic versioning tags)  
**Status**: ✅ ACTIVE  
**Purpose**: Protect production releases from accidental deletion

### Protection Rules

```yaml
Require Status Checks to Pass:
  Status: ENABLED
  Required Checks:
    ├─ lint
    ├─ test
    ├─ security
    └─ build

Require Code Owner Review:
  Status: ENABLED
  └─ Release manager sign-off required

Allow Force Pushes:
  Status: DISABLED

Allow Deletions:
  Status: DISABLED
  └─ Tags cannot be deleted without admin intervention
```

## Deployment Environment Protection

### Development Environment

```yaml
Environment: development
Required Reviewers: None
Deployment Branches: develop
Auto-trigger: On push to develop
Deployment Timeout: 10 minutes
Secrets: DEV_* (limited scope)
```

### Staging Environment

```yaml
Environment: staging
Required Reviewers: 1 (any team member)
Deployment Branches: main
Auto-trigger: On merge to main
Deployment Timeout: 15 minutes
Secrets: STAGING_* (wider scope)

Deployment Concurrency:
  └─ Max 1 simultaneous deployment
```

### Production Environment

```yaml
Environment: production
Required Reviewers:
  ├─ Release Manager (person-specific)
  ├─ Tech Lead
  ├─ Operations Lead (at least 1 of 2 required)

Deployment Branches: tags (v*)
Auto-trigger: Manual approval required
Deployment Timeout: 30 minutes
Secrets: PROD_* (highest security)

Deployment Concurrency:
  └─ Max 1 simultaneous deployment

Approval Timeout: 24 hours
├─ Deployment auto-rejected if unapproved
└─ Requires restart of workflow
```

## Implementation Guide

### GitHub UI Configuration

1. **Navigate to Settings**
   ```
   Repository → Settings → Branches
   ```

2. **Add Branch Protection Rule**
   ```
   Branch name pattern: main
   ```

3. **Configure Protections**
   - ✅ Require pull request reviews before merging
     - Dismiss stale pull request approvals: ON
     - Require review from code owners: ON
   
   - ✅ Require status checks to pass before merging
     - Require branches to be up to date before merging: ON
   
   - ✅ Require code reviews
     - Minimum required: 1
   
   - ✅ Require signed commits: ON
   
   - ✅ Restrict who can push
     - Allow: @nextgen-market/devops-team (emergency hotfixes)

4. **Save Protection Rule**

### GitHub CLI Configuration

```bash
# Create branch protection rule
gh api repos/nextgen-market/nextgen-market/branches/main/protection \
  --input protection-rule.json

# Example protection-rule.json
cat > protection-rule.json << 'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["lint", "test", "security", "build"]
  },
  "required_pull_request_reviews": {
    "dismissal_restrictions": {},
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "require_last_push_approval": true,
    "required_approving_review_count": 1
  },
  "enforce_admins": true,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "restrictions": {
    "users": [],
    "teams": ["devops-team"],
    "apps": []
  }
}
EOF

gh api repos/nextgen-market/nextgen-market/branches/main/protection \
  --input protection-rule.json
```

### Terraform Configuration

```hcl
# terraform/github-branch-protection.tf

resource "github_branch_protection" "main" {
  repository_id = data.github_repository.main.node_id
  pattern       = "main"
  
  required_status_checks {
    strict = true
    contexts = [
      "lint",
      "test",
      "security",
      "build"
    ]
  }
  
  required_pull_request_reviews {
    dismiss_stale_reviews           = true
    require_code_owner_reviews      = true
    required_approving_review_count = 1
  }
  
  enforce_admins = true
  
  restrictions {
    teams = ["devops-team"]
  }
}

resource "github_branch_protection" "develop" {
  repository_id = data.github_repository.main.node_id
  pattern       = "develop"
  
  required_status_checks {
    strict = true
    contexts = [
      "lint",
      "test",
      "build"
    ]
  }
  
  enforce_admins = false
}

resource "github_branch_protection" "version_tags" {
  repository_id = data.github_repository.main.node_id
  pattern       = "v*"
  
  required_status_checks {
    strict = true
    contexts = [
      "lint",
      "test",
      "security",
      "build"
    ]
  }
  
  required_pull_request_reviews {
    required_approving_review_count = 1
    require_code_owner_reviews      = true
  }
  
  allow_deletions  = false
  allow_force_push = false
}
```

## Escalation Procedures

### Bypass Branch Protection (Emergency Hotfix)

**Only for Critical Production Issues**

```bash
1. Page on-call: PagerDuty
2. Document incident: Jira
3. Create hotfix branch: hotfix/issue-xxx
4. Create PR with emergency label
5. Get 2 approvals (manager + tech lead)
6. Admin bypass merge to main
7. Immediate deployment
8. Post-mortem within 24 hours
```

### Appeal Process for Stale Reviews

```
1. PR author requests review update
2. Reviewer has 4 hours to respond
3. If no response: escalate to tech lead
4. Tech lead can override (after 8 hours)
5. Document all overrides
```

## Monitoring & Compliance

### Weekly Audit

```bash
# Check all branch protection rules
gh api repos/nextgen-market/nextgen-market/branches \
  --jq '.[] | select(.protected) | .name'

# Audit PRs bypassing protection
gh api repos/nextgen-market/nextgen-market/pulls \
  --state closed \
  --jq '.[] | select(.merged) | {number, title, mergeable_state}'
```

### Metrics to Track

```yaml
Metrics:
  ├─ % of PRs requiring all reviews before merge
  ├─ Average review time (target: < 4 hours)
  ├─ % of PRs failing status checks
  ├─ Number of emergency bypasses (target: 0)
  ├─ Code review quality scores
  └─ Time to fix security findings

SLOs:
  ├─ 100% of main branch commits from approved PRs
  ├─ < 1% emergency bypass rate
  ├─ < 2% status check failures (chronic)
  └─ 95% of security issues fixed within 48 hours
```
