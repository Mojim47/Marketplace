import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { sha256Hex, verifyModelContract } from './model-contract';

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'model-contract-'));
}

function signContractPayload(
  payload: Record<string, unknown>,
  privateKeyPem: string
): string {
  const canonical = JSON.stringify({ ...payload, signatureBase64: undefined });
  const signer = crypto.createSign('sha256');
  signer.update(canonical);
  signer.end();
  return signer.sign(privateKeyPem).toString('base64');
}

describe('verifyModelContract', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('verifies a valid contract and artifacts', () => {
    const dir = createTempDir();
    tempDirs.push(dir);

    const artifactPath = path.join(dir, 'model.onnx');
    const tokenizerPath = path.join(dir, 'tokenizer.json');
    fs.writeFileSync(artifactPath, 'artifact-v1', 'utf8');
    fs.writeFileSync(tokenizerPath, '{"tokenizer":"v1"}', 'utf8');

    const contractPath = path.join(dir, 'model.contract.json');
    writeJson(contractPath, {
      modelName: 'nextgen-ai',
      modelVersion: '2026.1.0',
      artifactPath: './model.onnx',
      artifactSha256: crypto.createHash('sha256').update(fs.readFileSync(artifactPath)).digest('hex'),
      tokenizerPath: './tokenizer.json',
      tokenizerSha256: crypto
        .createHash('sha256')
        .update(fs.readFileSync(tokenizerPath))
        .digest('hex'),
      datasetHash: sha256Hex('dataset-v1'),
      metrics: {
        evaluationMetric: 'f1',
        evaluationValue: 0.91,
        minimumAcceptedValue: 0.85,
      },
      driftBaseline: {
        metric: 'psi',
        threshold: 0.2,
      },
      signedAt: new Date().toISOString(),
    });

    const verified = verifyModelContract({ contractPath });
    expect(verified.contract.modelName).toBe('nextgen-ai');
    expect(verified.artifactPath).toBe(artifactPath);
    expect(verified.tokenizerPath).toBe(tokenizerPath);
  });

  it('rejects missing contract file', () => {
    expect(() =>
      verifyModelContract({ contractPath: path.join(os.tmpdir(), 'not-found.contract.json') })
    ).toThrow(/Model contract not found/);
  });

  it('rejects invalid contract shape and hash formats', () => {
    const dir = createTempDir();
    tempDirs.push(dir);
    const contractPath = path.join(dir, 'model.contract.json');

    writeJson(contractPath, {
      modelName: 'nextgen-ai',
      modelVersion: '2026.1.0',
      artifactPath: './model.onnx',
      artifactSha256: 'not-a-sha256',
      datasetHash: 'also-invalid',
      metrics: {},
      driftBaseline: {},
      signedAt: new Date().toISOString(),
    });

    expect(() => verifyModelContract({ contractPath })).toThrow(/invalid artifactSha256/);
  });

  it('rejects tokenizerPath without tokenizerSha256', () => {
    const dir = createTempDir();
    tempDirs.push(dir);

    const artifactPath = path.join(dir, 'model.onnx');
    fs.writeFileSync(artifactPath, 'artifact-v1', 'utf8');

    const contractPath = path.join(dir, 'model.contract.json');
    writeJson(contractPath, {
      modelName: 'nextgen-ai',
      modelVersion: '2026.1.0',
      artifactPath: './model.onnx',
      artifactSha256: crypto.createHash('sha256').update(fs.readFileSync(artifactPath)).digest('hex'),
      tokenizerPath: './tokenizer.json',
      datasetHash: sha256Hex('dataset-v1'),
      metrics: {
        evaluationMetric: 'f1',
        evaluationValue: 0.91,
        minimumAcceptedValue: 0.85,
      },
      driftBaseline: {
        metric: 'psi',
        threshold: 0.2,
      },
      signedAt: new Date().toISOString(),
    });

    expect(() => verifyModelContract({ contractPath })).toThrow(/tokenizerSha256 is required/);
  });

  it('rejects checksum mismatches for model artifacts', () => {
    const dir = createTempDir();
    tempDirs.push(dir);

    const artifactPath = path.join(dir, 'model.onnx');
    fs.writeFileSync(artifactPath, 'artifact-v1', 'utf8');

    const contractPath = path.join(dir, 'model.contract.json');
    writeJson(contractPath, {
      modelName: 'nextgen-ai',
      modelVersion: '2026.1.0',
      artifactPath: './model.onnx',
      artifactSha256: sha256Hex('wrong-artifact'),
      datasetHash: sha256Hex('dataset-v1'),
      metrics: {
        evaluationMetric: 'f1',
        evaluationValue: 0.91,
        minimumAcceptedValue: 0.85,
      },
      driftBaseline: {
        metric: 'psi',
        threshold: 0.2,
      },
      signedAt: new Date().toISOString(),
    });

    expect(() => verifyModelContract({ contractPath })).toThrow(/checksum mismatch/);
  });

  it('enforces strict signature rules', () => {
    const dir = createTempDir();
    tempDirs.push(dir);
    const artifactPath = path.join(dir, 'model.onnx');
    fs.writeFileSync(artifactPath, 'artifact-v1', 'utf8');
    const contractPath = path.join(dir, 'model.contract.json');

    writeJson(contractPath, {
      modelName: 'nextgen-ai',
      modelVersion: '2026.1.0',
      artifactPath: './model.onnx',
      artifactSha256: crypto.createHash('sha256').update(fs.readFileSync(artifactPath)).digest('hex'),
      datasetHash: sha256Hex('dataset-v1'),
      metrics: {
        evaluationMetric: 'f1',
        evaluationValue: 0.91,
        minimumAcceptedValue: 0.85,
      },
      driftBaseline: {
        metric: 'psi',
        threshold: 0.2,
      },
      signedAt: new Date().toISOString(),
    });

    expect(() => verifyModelContract({ contractPath, strictSignature: true })).toThrow(
      /unsigned while strictSignature=true/
    );

    const base = JSON.parse(fs.readFileSync(contractPath, 'utf8')) as Record<string, unknown>;
    base.signatureBase64 = 'abc123';
    writeJson(contractPath, base);
    expect(() => verifyModelContract({ contractPath, strictSignature: true })).toThrow(
      /MODEL_CONTRACT_PUBLIC_KEY_PEM is required/
    );
  });

  it('verifies a valid signature and rejects invalid base64/signatures', () => {
    const dir = createTempDir();
    tempDirs.push(dir);

    const artifactPath = path.join(dir, 'model.onnx');
    fs.writeFileSync(artifactPath, 'artifact-v1', 'utf8');

    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    const privateKeyPem = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
    const publicKeyPem = publicKey.export({ type: 'pkcs1', format: 'pem' }).toString();

    const payload: Record<string, unknown> = {
      modelName: 'nextgen-ai',
      modelVersion: '2026.1.0',
      artifactPath: './model.onnx',
      artifactSha256: crypto.createHash('sha256').update(fs.readFileSync(artifactPath)).digest('hex'),
      datasetHash: sha256Hex('dataset-v1'),
      metrics: {
        evaluationMetric: 'f1',
        evaluationValue: 0.91,
        minimumAcceptedValue: 0.85,
      },
      driftBaseline: {
        metric: 'psi',
        threshold: 0.2,
      },
      signedAt: new Date().toISOString(),
    };

    const contractPath = path.join(dir, 'model.contract.json');
    writeJson(contractPath, {
      ...payload,
      signatureBase64: signContractPayload(payload, privateKeyPem),
    });

    expect(() =>
      verifyModelContract({
        contractPath,
        strictSignature: true,
        signaturePublicKeyPem: publicKeyPem,
      })
    ).not.toThrow();

    writeJson(contractPath, { ...payload, signatureBase64: '@@@' });
    expect(() =>
      verifyModelContract({
        contractPath,
        strictSignature: true,
        signaturePublicKeyPem: publicKeyPem,
      })
    ).toThrow(/invalid signatureBase64/);

    writeJson(contractPath, { ...payload, signatureBase64: Buffer.from('invalid').toString('base64') });
    expect(() =>
      verifyModelContract({
        contractPath,
        strictSignature: true,
        signaturePublicKeyPem: publicKeyPem,
      })
    ).toThrow(/signature verification failed/);
  });
});
