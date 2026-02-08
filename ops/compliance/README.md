# Compliance Automation Suite

## Agent Overview

### Manufacturer Agent (agent-mfg)

Generates: CE-DoC + PFMEA + ISO9001 + GS1 Digital Link

```bash
npm run compliance:mfg-bundle
```

### Authorised Representative Agent (agent-ar)

Generates: AR Address + e-DoC Signature + DPC Ireland

```bash
npm run compliance:ar-bundle
```

### Output Bundle

**Location:** `ops/compliance/mfg-bundle/`

**Contents:**
- `csr.risk.json` - CSR validation with GS1 identifier
- `pfmea.json` - Process FMEA (RPN: 60 < 70 ✅)
- `lca.json` - Carbon footprint (0.85 kg CO2e < 1.2 ✅)
- `ce_declaration.json` - CE Declaration of Conformity
- `qr.svg` - GS1 Digital Link QR code
- `.well-known/gs1resolver.json` - GS1 resolver config
- `sbom.json` - CycloneDX SBOM

**Tarball:** `mfg-bundle-v1.0.0.tar.gz`

### Validation Stages

| Stage | Input | Output | Risk Check |
|-------|-------|--------|------------|
| 1-1 | CSR, Product Code | `csr.risk.json` | ❌ STOP if no GS1 ID |
| 1-2 | PFMEA Template | `pfmea.json` | 🔴 Highlight if RPN > 70 |
| 1-3 | LCA Data | `lca.json` | ❌ STOP if emission > 1.2 |
| 1-4 | CE Template | `ce_declaration.json` | ❌ STOP if annexes incomplete |
| 1-5 | GS1 GTIN | `qr.svg` + `.well-known/` | ❌ STOP if resolver 404 |

### Docker Build

**Manufacturer Bundle:**
```bash
cd ops/compliance
docker build -f Dockerfile.mfg-bundle -t ghcr.io/ce-ir/mfg-bundle:1.0.0 .
docker push ghcr.io/ce-ir/mfg-bundle:1.0.0
```

**AR Bundle:**
```bash
cd ops/compliance
docker build -f Dockerfile.ar-bundle -t ghcr.io/ce-ir/ar-bundle:1.0.0 .
docker push ghcr.io/ce-ir/ar-bundle:1.0.0
```

### Verification

```bash
# Extract bundle
tar -xzf mfg-bundle-v1.0.0.tar.gz -C /tmp/verify

# Validate SBOM
cat /tmp/verify/sbom.json | jq '.components[].name'

# Check CE Declaration
cat /tmp/verify/ce_declaration.json | jq '.valid'
```

---

## AI Bias Testing

```bash
npm run compliance:bias-test
```

**Output:** `ops/compliance/ai-bias-report.json`

**Standard:** IEEE 7000-2021  
**Target:** FAR ≤ 1.0%

---

## Deployment Verification

```bash
npm run compliance:verify
```

Checks all critical compliance files exist.

---

## Integration

### Add to CI/CD

```yaml
# .github/workflows/compliance.yml
- name: Generate MFG Bundle
  run: npm run compliance:mfg-bundle

- name: Upload Bundle
  uses: actions/upload-artifact@v3
  with:
    name: mfg-bundle
    path: ops/compliance/mfg-bundle-v*.tar.gz
```

### Pre-Production Checklist

- [ ] Run `npm run compliance:mfg-bundle`
- [ ] Verify RPN < 70 in `pfmea.json`
- [ ] Verify emission < 1.2 in `lca.json`
- [ ] Validate CE annexes complete
- [ ] Test GS1 resolver endpoint
- [ ] Build Docker image
- [ ] Push to registry

---

## Standards Compliance

- **CE Marking:** Directives 2014/53/EU, 2011/65/EU
- **PFMEA:** AIAG & VDA FMEA Handbook
- **LCA:** ISO 14040:2006, ISO 14044:2006
- **GS1:** Digital Link Standard 1.2
- **SBOM:** CycloneDX 1.4
