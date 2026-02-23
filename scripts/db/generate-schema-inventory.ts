import fs from 'node:fs';
import path from 'node:path';

type FieldInfo = {
  name: string;
  type: string;
  optional: boolean;
  list: boolean;
  attributes: string[];
};

type ModelInfo = {
  model: string;
  table: string;
  fields: FieldInfo[];
  indexes: string[];
  uniques: string[];
};

const schemaPath = path.join('prisma', 'schema.prisma');
const outPath = path.join('artifacts', 'db-audit', 'schema-inventory.json');

function toTableName(model: string) {
  return `${model.toLowerCase()}s`;
}

function parseField(line: string): FieldInfo | null {
  const clean = line.trim();
  if (!clean || clean.startsWith('//') || clean.startsWith('@@')) {
    return null;
  }
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length < 2) {
    return null;
  }
  const name = parts[0];
  const rawType = parts[1];
  const attributes = parts.slice(2);

  const optional = rawType.endsWith('?');
  const list = rawType.endsWith('[]');
  const type = rawType.replace(/\?|\[\]/g, '');

  return {
    name,
    type,
    optional,
    list,
    attributes,
  };
}

function parseSchema(schema: string): ModelInfo[] {
  const models: ModelInfo[] = [];
  const modelRegex = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
  let match: RegExpExecArray | null = modelRegex.exec(schema);

  while (match) {
    const modelName = match[1];
    const body = match[2];
    const lines = body.split('\n').map((line) => line.trim());
    const fields: FieldInfo[] = [];
    const indexes: string[] = [];
    const uniques: string[] = [];
    let table = toTableName(modelName);

    for (const line of lines) {
      if (!line) {
        continue;
      }
      if (line.startsWith('@@map(')) {
        const mapped = line.match(/@@map\("(.+)"\)/);
        if (mapped?.[1]) {
          table = mapped[1];
        }
        continue;
      }
      if (line.startsWith('@@index(')) {
        indexes.push(line);
        continue;
      }
      if (line.startsWith('@@unique(')) {
        uniques.push(line);
        continue;
      }
      const field = parseField(line);
      if (field) {
        fields.push(field);
      }
    }

    models.push({
      model: modelName,
      table,
      fields,
      indexes,
      uniques,
    });

    match = modelRegex.exec(schema);
  }

  return models;
}

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function main() {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  const models = parseSchema(schema);
  const inventory = {
    generatedAt: new Date().toISOString(),
    schemaPath,
    modelCount: models.length,
    models,
  };

  ensureDir(outPath);
  fs.writeFileSync(outPath, JSON.stringify(inventory, null, 2), 'utf8');
  console.log(`Schema inventory written: ${outPath}`);
}

main();
