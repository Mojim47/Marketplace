import fs from 'node:fs';
import path from 'node:path';

type Candidate = {
  model: string;
  field: string;
  type: string;
  reason: string;
  suggestion: string;
};

const schemaPath = path.join('prisma', 'schema.prisma');
const outDir = path.join('artifacts', 'db-audit');
const outJson = path.join(outDir, 'constraints-audit.json');
const outMd = path.join(outDir, 'constraints-audit.md');

const semanticNamePattern = /(status|state|type|role|gateway|method|kind)$/i;

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function parse(schema: string): Candidate[] {
  const candidates: Candidate[] = [];
  const modelRegex = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
  let modelMatch: RegExpExecArray | null = modelRegex.exec(schema);

  while (modelMatch) {
    const modelName = modelMatch[1];
    const body = modelMatch[2];
    const lines = body.split('\n').map((line) => line.trim());

    for (const line of lines) {
      if (!line || line.startsWith('//') || line.startsWith('@@')) {
        continue;
      }
      const parts = line.split(/\s+/).filter(Boolean);
      if (parts.length < 2) {
        continue;
      }
      const field = parts[0];
      const type = parts[1].replace(/\?|\[\]/g, '');
      const attrs = parts.slice(2).join(' ');

      const isString = type === 'String';
      const semanticField = semanticNamePattern.test(field);
      const hasEnumHint = attrs.includes('//');

      if (isString && semanticField) {
        candidates.push({
          model: modelName,
          field,
          type,
          reason: hasEnumHint
            ? 'Semantic String with comment-level values only'
            : 'Semantic String without DB-level domain constraints',
          suggestion:
            'Use Prisma enum or database CHECK constraint (or reference table) and keep API validation aligned.',
        });
      }
    }

    modelMatch = modelRegex.exec(schema);
  }

  return candidates;
}

function writeMarkdown(candidates: Candidate[]) {
  const lines: string[] = [];
  lines.push('# DB Constraints Audit');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  if (candidates.length === 0) {
    lines.push('No semantic String columns requiring enum/check review were detected.');
    return lines.join('\n');
  }
  lines.push('| Model | Field | Reason | Suggestion |');
  lines.push('|---|---|---|---|');
  for (const c of candidates) {
    lines.push(`| ${c.model} | ${c.field} | ${c.reason} | ${c.suggestion} |`);
  }
  return lines.join('\n');
}

function main() {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  const candidates = parse(schema);

  ensureDir(outDir);

  const report = {
    generatedAt: new Date().toISOString(),
    schemaPath,
    candidateCount: candidates.length,
    candidates,
  };

  fs.writeFileSync(outJson, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(outMd, writeMarkdown(candidates), 'utf8');

  console.log(`Constraints audit JSON: ${outJson}`);
  console.log(`Constraints audit MD: ${outMd}`);
  console.log(`Candidates: ${candidates.length}`);
}

main();
