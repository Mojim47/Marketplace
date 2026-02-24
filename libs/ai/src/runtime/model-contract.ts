import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface ModelContractMetrics {
  evaluationMetric: string;
  evaluationValue: number;
  minimumAcceptedValue: number;
}

export interface ModelContractDriftBaseline {
  metric: string;
  threshold: number;
}

export interface ModelContract {
  modelName: string;
  modelVersion: string;
  artifactPath: string;
  artifactSha256: string;
  tokenizerPath?: string;
  tokenizerSha256?: string;
  datasetHash: string;
  metrics: ModelContractMetrics;
  driftBaseline: ModelContractDriftBaseline;
  signedAt: string;
  signatureBase64?: string;
}

export interface ModelContractVerificationOptions {
  contractPath: string;
  strictSignature?: boolean;
  signaturePublicKeyPem?: string;
}

export interface VerifiedModelContract {
  contract: ModelContract;
  contractPath: string;
  artifactPath: string;
  tokenizerPath?: string;
}

export function verifyModelContract(
  options: ModelContractVerificationOptions
): VerifiedModelContract {
  const contractPath = resolvePath(options.contractPath);
  if (!fs.existsSync(contractPath)) {
    throw new Error(`Model contract not found: ${contractPath}`);
  }

  const raw = fs.readFileSync(contractPath, 'utf-8');
  const parsed = JSON.parse(raw) as ModelContract;
  validateContractShape(parsed, contractPath);

  const artifactPath = resolveFrom(contractPath, parsed.artifactPath);
  assertSha256File(artifactPath, parsed.artifactSha256, 'model artifact');

  let tokenizerPath: string | undefined;
  if (parsed.tokenizerPath) {
    tokenizerPath = resolveFrom(contractPath, parsed.tokenizerPath);
    if (!parsed.tokenizerSha256) {
      throw new Error(
        'Model contract invalid: tokenizerSha256 is required when tokenizerPath exists'
      );
    }
    assertSha256File(tokenizerPath, parsed.tokenizerSha256, 'tokenizer artifact');
  }

  verifySignature({
    contract: parsed,
    rawContent: raw,
    strictSignature: options.strictSignature ?? false,
    publicKeyPem: options.signaturePublicKeyPem,
    contractPath,
  });

  return {
    contract: parsed,
    contractPath,
    artifactPath,
    tokenizerPath,
  };
}

export function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function resolvePath(inputPath: string): string {
  return path.isAbsolute(inputPath) ? inputPath : path.resolve(process.cwd(), inputPath);
}

function resolveFrom(baseFilePath: string, targetPath: string): string {
  if (path.isAbsolute(targetPath)) {
    return targetPath;
  }
  return path.resolve(path.dirname(baseFilePath), targetPath);
}

function assertSha256File(filePath: string, expectedHash: string, label: string): void {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found: ${filePath}`);
  }
  const actual = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  if (actual.toLowerCase() !== expectedHash.toLowerCase()) {
    throw new Error(`${label} checksum mismatch for ${filePath}`);
  }
}

function validateContractShape(contract: ModelContract, contractPath: string): void {
  const requiredStringKeys: Array<keyof ModelContract> = [
    'modelName',
    'modelVersion',
    'artifactPath',
    'artifactSha256',
    'datasetHash',
    'signedAt',
  ];
  for (const key of requiredStringKeys) {
    if (!contract[key] || typeof contract[key] !== 'string') {
      throw new Error(`Model contract ${contractPath} missing required field: ${String(key)}`);
    }
  }

  if (!/^[a-fA-F0-9]{64}$/.test(contract.artifactSha256)) {
    throw new Error(`Model contract ${contractPath} has invalid artifactSha256`);
  }
  if (!/^[a-fA-F0-9]{64}$/.test(contract.datasetHash)) {
    throw new Error(`Model contract ${contractPath} has invalid datasetHash`);
  }

  if (!contract.metrics || typeof contract.metrics !== 'object') {
    throw new Error(`Model contract ${contractPath} missing metrics`);
  }
  if (!contract.driftBaseline || typeof contract.driftBaseline !== 'object') {
    throw new Error(`Model contract ${contractPath} missing driftBaseline`);
  }
}

function verifySignature(params: {
  contract: ModelContract;
  rawContent: string;
  strictSignature: boolean;
  publicKeyPem?: string;
  contractPath: string;
}): void {
  const { contract, rawContent, strictSignature, publicKeyPem, contractPath } = params;
  const signatureBase64 = contract.signatureBase64;
  if (!signatureBase64) {
    if (strictSignature) {
      throw new Error(`Model contract ${contractPath} is unsigned while strictSignature=true`);
    }
    return;
  }

  if (!publicKeyPem) {
    if (strictSignature) {
      throw new Error(
        'MODEL_CONTRACT_PUBLIC_KEY_PEM is required for strict signature verification'
      );
    }
    return;
  }

  const signatureBuffer = Buffer.from(signatureBase64, 'base64');
  if (signatureBuffer.length === 0) {
    throw new Error(`Model contract ${contractPath} has an invalid signatureBase64`);
  }

  const canonicalForVerify = JSON.stringify({
    ...contract,
    signatureBase64: undefined,
  });
  const verifier = crypto.createVerify('sha256');
  verifier.update(canonicalForVerify || rawContent);
  verifier.end();

  const verified = verifier.verify(publicKeyPem, signatureBuffer);
  if (!verified) {
    throw new Error(`Model contract ${contractPath} signature verification failed`);
  }
}
