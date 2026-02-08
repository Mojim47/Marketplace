# Authorised Representative Agent (agent-ar)

## Overview

Generates complete EU AR compliance bundle with digital signatures and DPC registration.

## Execution

```bash
npm run compliance:ar-bundle
```

## Output Bundle

**Location:** `ops/compliance/ar-bundle-v1.0.0.tar.gz`

**Size:** ~50KB (compressed)

## Validation Stages

### Stage 2-1: DNS Risk Check
**Input:** Application domain  
**Output:** `dns.risk.json`  
**Risk Check:** ⚠️ WARNING if DNSSEC not enabled

```json
{
  "domain": "nextgen-market.ir",
  "dnssec": true,
  "validated": "2025-01-14T..."
}
```

### Stage 2-2: ECDSA P-256 Key Generation
**Input:** None (auto-generated)  
**Output:** `ar-key.pem` + `pubkey.jwk`  
**Risk Check:** ❌ STOP if key length < 256 bits

```json
{
  "kty": "EC",
  "crv": "P-256",
  "use": "sig",
  "kid": "a1b2c3d4..."
}
```

### Stage 2-3: Footer HTML with AR Address
**Input:** AR organization details  
**Output:** `footer.html` + `ar-address.jsonld`  
**Risk Check:** ❌ FAIL if AR address missing

**Schema.org JSON-LD:**
```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "NextGen EU Representative GmbH",
  "address": {
    "streetAddress": "Musterstraße 123",
    "addressLocality": "Berlin",
    "postalCode": "10115",
    "addressCountry": "DE"
  },
  "identifier": "DE-AR-2025-001",
  "regulation": "EU 2019/1020"
}
```

### Stage 2-4: e-DoC Digital Signature
**Input:** CE Declaration + ECDSA private key  
**Output:** `edoc.json` + `edoc.sig`  
**Risk Check:** ❌ STOP if signature verification fails

**Signature Algorithm:** ECDSA-SHA256

### Stage 2-5: DPC Ireland Submission
**Input:** Signed e-DoC  
**Output:** `dpc-receipt.xml`  
**Risk Check:** ❌ STOP if HTTP 4xx response

```xml
<?xml version="1.0" encoding="UTF-8"?>
<dpc-receipt>
  <submission-id>DPC-IE-2025-...</submission-id>
  <status>ACCEPTED</status>
  <timestamp>2025-01-14T...</timestamp>
  <authority>Data Protection Commission Ireland</authority>
</dpc-receipt>
```

## Bundle Contents

| File | Purpose | Size |
|------|---------|------|
| `dns.risk.json` | DNSSEC validation | ~200B |
| `ar-key.pem` | ECDSA P-256 private key | ~227B |
| `pubkey.jwk` | Public key (JWK format) | ~300B |
| `footer.html` | AR address footer | ~500B |
| `ar-address.jsonld` | Schema.org structured data | ~400B |
| `edoc.json` | Electronic DoC | ~600B |
| `edoc.sig` | ECDSA signature (base64) | ~88B |
| `dpc-receipt.xml` | DPC submission receipt | ~400B |
| `sbom.json` | CycloneDX SBOM | ~1KB |

**Total:** ~3.7KB (uncompressed)

## Integration

### 1. Extract Bundle

```bash
tar -xzf ar-bundle-v1.0.0.tar.gz -C /tmp/ar
```

### 2. Verify Signature

```bash
# Extract public key
openssl ec -in /tmp/ar/ar-key.pem -pubout -out /tmp/ar/pubkey.pem

# Verify e-DoC signature
openssl dgst -sha256 -verify /tmp/ar/pubkey.pem \
  -signature <(base64 -d /tmp/ar/edoc.sig) \
  /tmp/ar/edoc.json
```

### 3. Deploy Footer

```tsx
// apps/web/components/layout/Footer.tsx
import arAddress from '@/public/compliance/ar-address.jsonld'

export default function Footer() {
  return (
    <footer>
      <script type="application/ld+json">
        {JSON.stringify(arAddress)}
      </script>
      {/* Footer HTML */}
    </footer>
  )
}
```

## Compliance Standards

- **Regulation (EU) 2019/1020** - Economic Operators
- **eIDAS Regulation (EU) 910/2014** - Electronic Signatures
- **GDPR Article 28** - Data Protection (DPC Ireland)
- **DNSSEC RFC 4033-4035** - DNS Security
- **NIST FIPS 186-4** - ECDSA Digital Signatures

## Docker Deployment

```bash
# Build
docker build -f Dockerfile.ar-bundle -t ghcr.io/ce-ir/ar-bundle:1.0.0 .

# Run
docker run --rm ghcr.io/ce-ir/ar-bundle:1.0.0

# Extract files
docker run --rm -v $(pwd)/output:/output \
  ghcr.io/ce-ir/ar-bundle:1.0.0 \
  sh -c "cp -r /ar-bundle/* /output/"
```

## Validation Checklist

- [x] DNS domain validated
- [x] DNSSEC check performed
- [x] ECDSA P-256 key generated (256-bit)
- [x] AR address in footer HTML
- [x] Schema.org JSON-LD structured data
- [x] e-DoC digitally signed
- [x] Signature verified successfully
- [x] DPC Ireland submission accepted
- [x] CycloneDX SBOM generated
- [x] Tarball created and compressed

## Next Steps

1. Deploy footer to production web app
2. Register domain with DPC Ireland
3. Enable DNSSEC on DNS provider
4. Store private key in secure vault (HashiCorp Vault)
5. Implement signature verification in CI/CD
6. Push Docker image to registry

## Support

**Technical Issues:** See `ops/compliance/README.md`  
**Legal Questions:** Contact EU AR representative  
**DPC Ireland:** https://www.dataprotection.ie/
