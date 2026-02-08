# Azure Load Testing Configuration Guide

## 📋 Overview

This guide explains how to set up and run load testing on Azure using Azure Load Testing service with K6 scripts.

---

## 1️⃣ Prerequisites

### Required Resources
- Azure Subscription
- Azure Resource Group
- Azure Load Testing Service (create if not exists)
- API endpoint URL (e.g., https://api.example.com)

### Azure CLI Setup

```bash
# Install Azure CLI
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Login to Azure
az login

# Set default subscription
az account set --subscription <subscription-id>

# Set default resource group
az config set defaults.group=<resource-group-name>
```

---

## 2️⃣ Create Azure Load Testing Service

```bash
# Create Load Testing resource
az load create \
  --load-test-resource nextgen-load-test \
  --location eastus \
  --display-name "NextGen Marketplace Load Testing"

# Verify creation
az load show \
  --load-test-resource nextgen-load-test
```

---

## 3️⃣ Configure K6 Scripts for Azure

### Upload Load Testing Files

```bash
# Create tests directory
mkdir -p azure-load-tests

# Copy K6 scripts
cp tests/load/load-test.js azure-load-tests/
cp tests/load/spike-test.js azure-load-tests/
cp tests/load/soak-test.js azure-load-tests/
cp tests/load/stress-test.js azure-load-tests/
```

### Create Azure Load Testing Configuration

```json
{
  "version": "0.1",
  "loadTestConfig": {
    "engineInstances": 1,
    "quickStartScenarioName": "DefaultScenario",
    "configurationFiles": [],
    "inputArtifacts": {
      "configFileInfo": []
    },
    "optionalLoadTestConfig": {
      "isRegional": false,
      "requestsPerSecondThreshold": 1000
    },
    "env": [
      {
        "name": "BASE_URL",
        "value": "https://api.example.com"
      }
    ]
  },
  "testRunStatistics": []
}
```

---

## 4️⃣ Run Load Tests on Azure

### Option 1: Standard Load Test

```bash
# Create and run standard load test
az load test-run create \
  --load-test-resource nextgen-load-test \
  --test-run-id "load-test-run-1" \
  --display-name "Standard Load Test" \
  --test-file tests/load/load-test.js \
  --engine-instances 3 \
  --duration 420 \
  --ramp-up-time 60 \
  --threads 20 \
  --think-time 10
```

### Option 2: Spike Test

```bash
# Run spike test
az load test-run create \
  --load-test-resource nextgen-load-test \
  --test-run-id "spike-test-run-1" \
  --display-name "Spike Test" \
  --test-file tests/load/spike-test.js \
  --engine-instances 5 \
  --duration 280
```

### Option 3: Soak Test

```bash
# Run soak test (1+ hours)
az load test-run create \
  --load-test-resource nextgen-load-test \
  --test-run-id "soak-test-run-1" \
  --display-name "Weekly Soak Test" \
  --test-file tests/load/soak-test.js \
  --engine-instances 2 \
  --duration 3600 \
  --env BASE_URL=https://api.example.com
```

### Option 4: Stress Test

```bash
# Run stress test
az load test-run create \
  --load-test-resource nextgen-load-test \
  --test-run-id "stress-test-run-1" \
  --display-name "Stress Test" \
  --test-file tests/load/stress-test.js \
  --engine-instances 10 \
  --duration 1140
```

---

## 5️⃣ Monitor Test Execution

### View Running Test

```bash
# Get test status
az load test-run show \
  --load-test-resource nextgen-load-test \
  --test-run-id "load-test-run-1"

# Stream test logs
az load test-run logs \
  --load-test-resource nextgen-load-test \
  --test-run-id "load-test-run-1"
```

### Real-time Metrics

```bash
# Get current metrics
az load test-run metrics \
  --load-test-resource nextgen-load-test \
  --test-run-id "load-test-run-1" \
  --metric-namespace "LoadTestRunMetrics" \
  --metric "Virtual Users" \
  --aggregation "Average"
```

---

## 6️⃣ View Results in Azure Portal

1. **Navigate to Azure Portal**
   ```
   Azure Portal → Load Testing → Test runs
   ```

2. **Select Test Run**
   ```
   Click on "load-test-run-1"
   ```

3. **View Dashboard**
   - **Response time**: p50, p90, p95, p99
   - **Throughput**: Requests per second
   - **Error rate**: Percentage of failed requests
   - **Virtual users**: Number of concurrent users
   - **Engine health**: CPU, Memory, Network

---

## 7️⃣ Export Results

### Download CSV Report

```bash
# List available results
az load test-run download-results \
  --load-test-resource nextgen-load-test \
  --test-run-id "load-test-run-1" \
  --file-type "CSV" \
  --output-path "./results/"
```

### Generate JSON Report

```bash
# Export as JSON
az load test-run download-results \
  --load-test-resource nextgen-load-test \
  --test-run-id "load-test-run-1" \
  --file-type "JSON" \
  --output-path "./results/"
```

---

## 8️⃣ Set Up Alerts

### Create Alert Rule

```bash
# Alert on high response time
az monitor metrics-alert create \
  --resource-group <resource-group> \
  --name "High Response Time" \
  --scopes /subscriptions/<sub-id>/resourceGroups/<rg>/providers/Microsoft.LoadTestService/loadTests/nextgen-load-test \
  --condition "avg ResponseTime > 1000" \
  --window-size 5m \
  --evaluation-frequency 1m
```

### Create Alert Action

```bash
# Create action group for notifications
az monitor action-group create \
  --resource-group <resource-group> \
  --name "LoadTestAlerts"

# Add email action
az monitor action-group update \
  --resource-group <resource-group> \
  --name "LoadTestAlerts" \
  --add-action email --email-receiver admin@example.com
```

---

## 9️⃣ CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Azure Load Testing

on:
  schedule:
    - cron: '0 2 * * 0'  # Weekly

jobs:
  azure-load-test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Azure Login
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}
      
      - name: Run Load Test
        uses: azure/load-testing@v1
        with:
          loadTestConfigFile: 'loadtest.yaml'
          loadTestResource: 'nextgen-load-test'
          resourceGroup: 'nextgen-rg'
          testRunId: 'github-${{ github.run_id }}'
          displayName: 'GitHub Actions Load Test'
      
      - name: Publish Results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: load-test-results
          path: results/
```

---

## 🔟 Performance Thresholds

### Acceptable Metrics

| Metric | Threshold | Action if Exceeded |
|--------|-----------|-------------------|
| p95 Response Time | < 500ms | Investigate |
| p99 Response Time | < 1000ms | Optimize |
| Error Rate | < 1% | Debug |
| Throughput | > 500 req/sec | Scale |
| CPU Usage | < 80% | Monitor |
| Memory Usage | < 85% | Monitor |

### Threshold Configuration in K6

```javascript
export const options = {
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'],
    'http_req_failed': ['rate<0.01'],
  },
};
```

---

## 1️⃣1️⃣ Troubleshooting

### Test Won't Start

```bash
# Check resource status
az load show --load-test-resource nextgen-load-test

# Check permissions
az role assignment list --query "[?principalName=='<email>']"

# Verify API endpoint accessibility
curl -I https://api.example.com
```

### High Failure Rate

```bash
# Check error details
az load test-run metrics \
  --load-test-resource nextgen-load-test \
  --test-run-id "load-test-run-1" \
  --metric-namespace "LoadTestRunMetrics" \
  --metric "Request Failures"

# Review application logs
az monitor log-analytics query -w <workspace-id>
```

### Out of Memory

```bash
# Reduce engine instances
# Reduce virtual users in K6 script
# Check for memory leaks in application
```

---

## 1️⃣2️⃣ Best Practices

✅ **Start Small**
- Begin with 10-20 users
- Gradually increase load
- Monitor for bottlenecks

✅ **Test Regularly**
- Weekly load tests (baseline)
- Before major releases
- After performance changes

✅ **Document Results**
- Keep historical data
- Track trends
- Document improvements

✅ **Use Realistic Data**
- Simulate real user behavior
- Include think times
- Use production-like dataset sizes

✅ **Scale Infrastructure**
- Use multiple engine instances
- Distribute load across regions
- Monitor infrastructure metrics

---

## 1️⃣3️⃣ Common Commands Reference

```bash
# Create test resource
az load create --load-test-resource <name> --location <region>

# List all test runs
az load test-run list --load-test-resource nextgen-load-test

# Get test details
az load test-run show --load-test-resource nextgen-load-test --test-run-id <id>

# Stop running test
az load test-run stop --load-test-resource nextgen-load-test --test-run-id <id>

# Delete test
az load delete --load-test-resource nextgen-load-test

# Stream logs
az load test-run logs --load-test-resource nextgen-load-test --test-run-id <id>

# Download results
az load test-run download-results --load-test-resource nextgen-load-test --test-run-id <id>
```

---

## 📞 Support

- **Azure Documentation**: https://learn.microsoft.com/en-us/azure/load-testing/
- **K6 Azure Integration**: https://grafana.com/docs/k6/latest/extensions/azure/
- **Azure CLI Reference**: https://learn.microsoft.com/en-us/cli/azure/

---

**Last Updated**: 2024-11-19  
**Status**: 🟢 Ready for Enterprise Deployment
