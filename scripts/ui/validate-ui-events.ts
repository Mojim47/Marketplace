import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import schema from '../../libs/observability/src/ui-event-schema.json';

const ROOTS = [
  path.join('apps', 'web', 'app'),
  path.join('apps', 'web', 'components'),
  path.join('apps', 'admin', 'app'),
  path.join('apps', 'admin', 'src', 'app'),
  path.join('apps', 'admin', 'src', 'components'),
];

const EXTENSIONS = new Set(['.ts', '.tsx']);
const allowed = new Set(Object.keys(schema.events));

function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'public' || entry.name === '.next') {
        continue;
      }
      files.push(...listFiles(full));
    } else if (EXTENSIONS.has(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

function report(file: string, line: number, message: string, errors: string[]) {
  errors.push(`${file}:${line} ${message}`);
}

function isTrackUiCall(node: ts.CallExpression, sourceFile: ts.SourceFile): boolean {
  if (ts.isIdentifier(node.expression)) {
    return node.expression.text === 'trackUiEvent';
  }
  if (ts.isPropertyAccessExpression(node.expression)) {
    return node.expression.name.getText(sourceFile) === 'trackUiEvent';
  }
  return false;
}

function checkFile(filePath: string, errors: string[]) {
  const sourceText = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && isTrackUiCall(node, sourceFile)) {
      const line = sourceFile.getLineAndCharacterOfPosition(node.pos).line + 1;
      const [firstArg] = node.arguments;
      if (!firstArg || !ts.isStringLiteral(firstArg)) {
        report(filePath, line, 'trackUiEvent must use a string literal event name', errors);
      } else if (!allowed.has(firstArg.text)) {
        report(filePath, line, `trackUiEvent uses undefined event: ${firstArg.text}`, errors);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

function main() {
  const errors: string[] = [];
  for (const root of ROOTS) {
    for (const file of listFiles(root)) {
      checkFile(file, errors);
    }
  }

  if (errors.length > 0) {
    console.error('UI event schema violations detected:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }
}

main();
