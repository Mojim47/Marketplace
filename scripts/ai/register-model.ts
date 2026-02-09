/* Model registry + ONNX hashing
 * Usage:
 *   pnpm model:hash    # generate/update manifest
 *   pnpm model:verify  # verify manifest matches ONNX files (CI)
 */

import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '..', '..');
const modelsDir = path.join(repoRoot, 'models');
const manifestPath = path.join(modelsDir, 'manifest.json');

type ModelRecord = {
  name: string;
  file: string;
  sha256: string;
  sizeBytes: number;
  tokenizerHash: string;
  approvedBy: string;
  updatedAt: string;
};

type Manifest = {
  generatedAt: string;
  models: ModelRecord[];
};

async function hashFile(filePath: string): Promise<{ sha256: string; size: number }> {
  const data = await fs.readFile(filePath);
  const sha256 = createHash('sha256').update(data).digest('hex');
  return { sha256, size: data.byteLength };
}

async function listOnnxFiles(): Promise<string[]> {
  const entries = await fs.readdir(modelsDir);
  return entries.filter((file) => file.toLowerCase().endsWith('.onnx')).map((file) => path.join(modelsDir, file));
}

async function loadManifest(): Promise<Manifest | null> {
  try {
    const raw = await fs.readFile(manifestPath, 'utf-8');
    return JSON.parse(raw) as Manifest;
  } catch (err: any) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

function normalizeRecord(rec: ModelRecord): ModelRecord {
  return {
    ...rec,
    sha256: rec.sha256.toLowerCase(),
  };
}

async function writeManifest(records: ModelRecord[]) {
  const manifest: Manifest = {
    generatedAt: new Date().toISOString(),
    models: records
      .map(normalizeRecord)
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Manifest written: ${manifestPath}`);
}

async function generateManifest() {
  const files = await listOnnxFiles();
  if (!files.length) {
    console.warn('No ONNX files found in models/. Nothing to do.');
    return;
  }

  const records: ModelRecord[] = [];
  for (const filePath of files) {
    const { sha256, size } = await hashFile(filePath);
    const tokenizerPath = path.join(modelsDir, `${path.basename(filePath, '.onnx')}.tokenizer.json`);
    let tokenizerHash = '';
    try {
      tokenizerHash = (await hashFile(tokenizerPath)).sha256;
    } catch (err: any) {
      throw new Error(`Tokenizer file missing for ${filePath}. Expected at ${tokenizerPath}`);
    }

    records.push({
      name: path.basename(filePath, '.onnx'),
      file: path.basename(filePath),
      sha256,
      sizeBytes: size,
      tokenizerHash,
      approvedBy: process.env.MODEL_APPROVED_BY || 'unknown',
      updatedAt: new Date().toISOString(),
    });
  }
  await writeManifest(records);
}

async function verifyManifest() {
  const manifest = await loadManifest();
  if (!manifest) {
    throw new Error('models/manifest.json is missing. Run pnpm model:hash to generate it.');
  }

  const files = await listOnnxFiles();
  const declared = new Map(manifest.models.map((m) => [m.file, normalizeRecord(m)]));

  const missingInManifest = files.filter((file) => !declared.has(path.basename(file)));
  if (missingInManifest.length) {
    throw new Error(`Manifest missing entries for: ${missingInManifest.map((f) => path.basename(f)).join(', ')}`);
  }

  for (const filePath of files) {
    const fileName = path.basename(filePath);
    const record = declared.get(fileName);
    if (!record) continue;

    const { sha256, size } = await hashFile(filePath);
    if (sha256.toLowerCase() !== record.sha256.toLowerCase()) {
      throw new Error(`Hash mismatch for ${fileName}. Manifest=${record.sha256} Actual=${sha256}`);
    }
    if (size !== record.sizeBytes) {
      throw new Error(`Size mismatch for ${fileName}. Manifest=${record.sizeBytes} Actual=${size}`);
    }

    const tokenizerPath = path.join(modelsDir, `${path.basename(filePath, '.onnx')}.tokenizer.json`);
    const tokenizerHash = (await hashFile(tokenizerPath)).sha256;
    if (tokenizerHash.toLowerCase() !== record.tokenizerHash.toLowerCase()) {
      throw new Error(
        `Tokenizer hash mismatch for ${fileName}. Manifest=${record.tokenizerHash} Actual=${tokenizerHash}`,
      );
    }

    if (!record.approvedBy || record.approvedBy === 'unknown') {
      throw new Error(`approvedBy missing for ${fileName}`);
    }
  }

  console.log('Model manifest verification passed.');
}

async function main() {
  const mode = process.argv.includes('--write') ? 'write' : process.argv.includes('--verify') ? 'verify' : 'verify';

  if (mode === 'write') {
    await generateManifest();
    return;
  }

  await verifyManifest();
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
