import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOTS = [
  path.join('apps', 'web', 'app'),
  path.join('apps', 'web', 'components'),
  path.join('apps', 'admin', 'app'),
  path.join('apps', 'admin', 'src', 'app'),
  path.join('apps', 'admin', 'src', 'components'),
];

const EXTENSIONS = new Set(['.ts', '.tsx']);

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

function getAttributeNames(node: ts.JsxAttributes): Set<string> {
  const attrs = new Set<string>();
  for (const prop of node.properties) {
    if (ts.isJsxAttribute(prop)) {
      if (ts.isIdentifier(prop.name)) {
        attrs.add(prop.name.text);
      } else if (ts.isJsxNamespacedName(prop.name)) {
        attrs.add(`${prop.name.namespace.text}:${prop.name.name.text}`);
      }
    }
  }
  return attrs;
}

function hasAttribute(node: ts.JsxAttributes, name: string): boolean {
  return getAttributeNames(node).has(name);
}

function getAttributeNameText(name: ts.JsxAttributeName): string | null {
  if (ts.isIdentifier(name)) {
    return name.text;
  }
  if (ts.isJsxNamespacedName(name)) {
    return `${name.namespace.text}:${name.name.text}`;
  }
  return null;
}

function getAttributeValue(node: ts.JsxAttributes, name: string): string | undefined {
  for (const prop of node.properties) {
    if (!ts.isJsxAttribute(prop) || !prop.initializer) {
      continue;
    }
    const attrName = getAttributeNameText(prop.name);
    if (!attrName || attrName !== name) {
      continue;
    }
    if (ts.isStringLiteral(prop.initializer)) {
      return prop.initializer.text;
    }
  }
  return undefined;
}

function report(file: string, line: number, message: string, errors: string[]) {
  errors.push(`${file}:${line} ${message}`);
}

function checkButton(
  tagName: string,
  attrs: ts.JsxAttributes,
  line: number,
  filePath: string,
  errors: string[]
) {
  if (tagName === 'Button' && !hasAttribute(attrs, 'loading')) {
    report(filePath, line, 'Button must include explicit loading prop', errors);
  }

  if (
    tagName === 'button' &&
    !hasAttribute(attrs, 'data-loading') &&
    !hasAttribute(attrs, 'aria-busy')
  ) {
    report(filePath, line, 'button must include data-loading or aria-busy', errors);
  }
}

function checkForm(
  tagName: string,
  attrs: ts.JsxAttributes,
  line: number,
  filePath: string,
  errors: string[]
) {
  if (tagName !== 'form') {
    return;
  }
  if (!hasAttribute(attrs, 'data-error-state')) {
    report(filePath, line, 'form must include data-error-state', errors);
  }
  if (!hasAttribute(attrs, 'data-empty-state')) {
    report(filePath, line, 'form must include data-empty-state', errors);
  }
}

function checkNav(
  tagName: string,
  attrs: ts.JsxAttributes,
  line: number,
  filePath: string,
  errors: string[]
) {
  if (tagName !== 'nav') {
    return;
  }
  if (!hasAttribute(attrs, 'aria-label')) {
    report(filePath, line, 'nav must include aria-label', errors);
  }
  if (!hasAttribute(attrs, 'data-keyboard-nav')) {
    report(filePath, line, 'nav must include data-keyboard-nav', errors);
  }
}

function checkDialog(
  tagName: string,
  attrs: ts.JsxAttributes,
  line: number,
  filePath: string,
  errors: string[]
) {
  const role = getAttributeValue(attrs, 'role');
  if (tagName === 'Dialog' || tagName === 'Modal' || role === 'dialog') {
    if (!hasAttribute(attrs, 'data-focus-trap') && !hasAttribute(attrs, 'aria-modal')) {
      report(filePath, line, 'dialog/modal must include data-focus-trap or aria-modal', errors);
    }
  }
}

function checkElement(
  tagName: string,
  attrs: ts.JsxAttributes,
  line: number,
  filePath: string,
  errors: string[]
) {
  checkButton(tagName, attrs, line, filePath, errors);
  checkForm(tagName, attrs, line, filePath, errors);
  checkNav(tagName, attrs, line, filePath, errors);
  checkDialog(tagName, attrs, line, filePath, errors);
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
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const tagName = node.tagName.getText(sourceFile);
      const attrs = node.attributes;
      const line = sourceFile.getLineAndCharacterOfPosition(node.pos).line + 1;
      checkElement(tagName, attrs, line, filePath, errors);
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
    console.error('UI anti-patterns detected:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }
}

main();
