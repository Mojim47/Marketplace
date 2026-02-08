#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Mock Files Detection Script for Production Builds
 * ═══════════════════════════════════════════════════════════════════════════
 * This script checks for mock files in production code paths and build output.
 * It should be run as part of CI/CD pipeline to prevent mock code from
 * being deployed to production.
 *
 * Requirements: 2.1, 2.3 - Detect and eliminate all mock patterns
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { readdir, stat, readFile, writeFile } from 'fs/promises';
import { join, relative } from 'path';
import { existsSync } from 'fs';

// ANSI color codes
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const NC = '\x1b[0m'; // No Color

let errors = 0;
let warnings = 0;
const mockReport = {
  timestamp: new Date().toISOString(),
  mockFiles: [],
  mockPatterns: [],
  placeholderPatterns: [],
  localhostReferences: [],
  summary: {
    totalIssues: 0,
    criticalIssues: 0,
    warnings: 0,
    passed: false
  }
};

/**
 * Enhanced mock file patterns detection
 */
const MOCK_FILE_PATTERNS = [
  'mock-',
  '.mock.',
  'simulate',
  'placeholder',
  '.fake.',
  '.stub.',
  '.dummy.'
];

/**
 * Content patterns to detect mock/placeholder code
 */
const MOCK_CONTENT_PATTERNS = [
  /TODO.*mock|FIXME.*mock|PLACEHOLDER/i,
  /function\s+(simulate|mock|fake|stub|dummy)/i,
  /const\s+(simulate|mock|fake|stub|dummy)/i,
  /Math\.random\(\)/g, // Detect random generators in business logic
  /setTimeout.*mock|setInterval.*mock/i,
  /console\.log.*mock|console\.log.*test/i
];

/**
 * Localhost patterns to detect hardcoded local references
 */
const LOCALHOST_PATTERNS = [
  /localhost|127\.0\.0\.1/g,
  /http:\/\/.*:3000|http:\/\/.*:8080/g
];

/**
 * Recursively find files matching patterns
 */
async function findFiles(dir, patterns, excludePatterns = []) {
  const results = [];
  
  if (!existsSync(dir)) {
    return results;
  }

  async function walk(currentDir) {
    try {
      const entries = await readdir(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);
        const relativePath = relative(process.cwd(), fullPath);
        
        // Skip excluded directories
        const shouldExclude = excludePatterns.some(pattern => {
          if (pattern.includes('*')) {
            const regex = new RegExp(pattern.replace(/\*/g, '.*'));
            return regex.test(relativePath);
          }
          return relativePath.includes(pattern);
        });
        
        if (shouldExclude) continue;
        
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile()) {
          const matchesPattern = patterns.some(pattern => {
            if (pattern.startsWith('*')) {
              return entry.name.endsWith(pattern.slice(1));
            }
            if (pattern.endsWith('*')) {
              return entry.name.startsWith(pattern.slice(0, -1));
            }
            return entry.name.includes(pattern);
          });
          
          if (matchesPattern) {
            results.push({
              path: relativePath,
              type: 'file',
              inProductionPath: !relativePath.includes('test') && !relativePath.includes('spec')
            });
          }
        }
      }
    } catch (err) {
      // Ignore permission errors
    }
  }
  
  await walk(dir);
  return results;
}

/**
 * Search for patterns in files with enhanced detection
 */
async function grepFiles(dir, searchPatterns, filePatterns, excludePatterns = []) {
  const results = [];
  
  if (!existsSync(dir)) {
    return results;
  }

  async function walk(currentDir) {
    try {
      const entries = await readdir(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);
        const relativePath = relative(process.cwd(), fullPath);
        
        const shouldExclude = excludePatterns.some(pattern => relativePath.includes(pattern));
        if (shouldExclude) continue;
        
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile()) {
          const matchesFilePattern = filePatterns.some(pattern => {
            return entry.name.endsWith(pattern);
          });
          
          if (matchesFilePattern) {
            try {
              const content = await readFile(fullPath, 'utf-8');
              const lines = content.split('\n');
              
              lines.forEach((line, index) => {
                searchPatterns.forEach(pattern => {
                  const matches = line.match(pattern);
                  if (matches) {
                    results.push({
                      file: relativePath,
                      line: index + 1,
                      content: line.trim().substring(0, 100),
                      pattern: pattern.toString(),
                      severity: relativePath.includes('apps/') || relativePath.includes('libs/') ? 'ERROR' : 'WARNING'
                    });
                  }
                });
              });
            } catch (err) {
              // Ignore read errors
            }
          }
        }
      }
    } catch (err) {
      // Ignore permission errors
    }
  }
  
  await walk(dir);
  return results;
}

/**
 * Generate detailed report
 */
async function generateReport() {
  const reportPath = 'mock-detection-report.json';
  mockReport.summary.totalIssues = errors + warnings;
  mockReport.summary.criticalIssues = errors;
  mockReport.summary.warnings = warnings;
  mockReport.summary.passed = errors === 0;
  
  await writeFile(reportPath, JSON.stringify(mockReport, null, 2));
  console.log(`\n📄 Detailed report saved to: ${reportPath}`);
}

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const strictMode = args.includes('--strict');
  
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log(`🔍 Enhanced Mock Files Detection Check ${strictMode ? '(STRICT MODE)' : ''}`);
  console.log('═══════════════════════════════════════════════════════════════════════════');

  // ─────────────────────────────────────────────────────────────────────────────
  // Check 1: Mock files in source directories (apps/ and libs/)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n📁 Checking for mock files in source directories...');

  const excludePatterns = ['node_modules', 'dist', '.next', '__mocks__', '__tests__', 'tests/', '.test.', '.spec.'];

  const mockFilesInApps = await findFiles('apps', MOCK_FILE_PATTERNS, excludePatterns);
  const mockFilesInLibs = await findFiles('libs', MOCK_FILE_PATTERNS, excludePatterns);
  const mockFilesInSrc = [...mockFilesInApps, ...mockFilesInLibs];

  mockReport.mockFiles = mockFilesInSrc;

  if (mockFilesInSrc.length > 0) {
    const productionMockFiles = mockFilesInSrc.filter(f => f.inProductionPath);
    
    if (productionMockFiles.length > 0) {
      console.log(`${RED}❌ ERROR: Mock files found in production paths:${NC}`);
      productionMockFiles.forEach(file => console.log(`   - ${file.path}`));
      errors++;
    } else {
      console.log(`${YELLOW}⚠️  Warning: Mock files found in test directories:${NC}`);
      mockFilesInSrc.forEach(file => console.log(`   - ${file.path}`));
      warnings++;
    }
  } else {
    console.log(`${GREEN}✅ No mock files found in source directories${NC}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Check 2: Mock files in build output directories
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n📦 Checking for mock files in build output...');

  const distExists = existsSync('dist') || existsSync('apps/api/dist') || existsSync('apps/web/.next');

  if (distExists) {
    const mockFilesInDist = [];
    
    if (existsSync('dist')) {
      mockFilesInDist.push(...await findFiles('dist', MOCK_FILE_PATTERNS, ['node_modules']));
    }
    
    // Check each app's dist directory
    if (existsSync('apps')) {
      const apps = await readdir('apps', { withFileTypes: true });
      for (const app of apps) {
        if (app.isDirectory()) {
          const distPath = join('apps', app.name, 'dist');
          const nextPath = join('apps', app.name, '.next');
          
          if (existsSync(distPath)) {
            mockFilesInDist.push(...await findFiles(distPath, MOCK_FILE_PATTERNS, ['node_modules']));
          }
          if (existsSync(nextPath)) {
            mockFilesInDist.push(...await findFiles(nextPath, MOCK_FILE_PATTERNS, ['node_modules']));
          }
        }
      }
    }

    if (mockFilesInDist.length > 0) {
      console.log(`${RED}❌ CRITICAL ERROR: Mock files found in build output!${NC}`);
      mockFilesInDist.forEach(file => console.log(`   - ${file.path}`));
      console.log('\n   Production builds MUST NOT contain mock files.');
      errors++;
    } else {
      console.log(`${GREEN}✅ Build output is clean - no mock files detected${NC}`);
    }
  } else {
    console.log(`${BLUE}ℹ️  Build output directories not found - skipping build check${NC}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Check 3: Mock/placeholder content patterns in production code
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n🔎 Checking for mock/placeholder patterns in production code...');

  const contentExcludes = ['node_modules', '.spec.ts', '.test.ts', '__tests__', 'dist', '.next', 'tests/'];
  
  const mockPatternsInApps = await grepFiles('apps', MOCK_CONTENT_PATTERNS, ['.ts', '.js', '.tsx', '.jsx'], contentExcludes);
  const mockPatternsInLibs = await grepFiles('libs', MOCK_CONTENT_PATTERNS, ['.ts', '.js', '.tsx', '.jsx'], contentExcludes);
  const allMockPatterns = [...mockPatternsInApps, ...mockPatternsInLibs];

  mockReport.mockPatterns = allMockPatterns;

  if (allMockPatterns.length > 0) {
    const criticalPatterns = allMockPatterns.filter(p => p.severity === 'ERROR');
    
    if (criticalPatterns.length > 0) {
      console.log(`${RED}❌ ERROR: Mock patterns found in production code:${NC}`);
      criticalPatterns.slice(0, 10).forEach(match => {
        console.log(`   ${match.file}:${match.line}: ${match.content}`);
      });
      errors++;
    } else {
      console.log(`${YELLOW}⚠️  Warning: Mock patterns found in test code:${NC}`);
      allMockPatterns.slice(0, 5).forEach(match => {
        console.log(`   ${match.file}:${match.line}: ${match.content}`);
      });
      warnings++;
    }
  } else {
    console.log(`${GREEN}✅ No mock patterns found in production code${NC}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Check 4: Localhost references in production code
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n🌐 Checking for localhost references...');

  const localhostInApps = await grepFiles('apps', LOCALHOST_PATTERNS, ['.ts', '.js', '.tsx', '.jsx', '.json'], contentExcludes);
  const localhostInLibs = await grepFiles('libs', LOCALHOST_PATTERNS, ['.ts', '.js', '.tsx', '.jsx', '.json'], contentExcludes);
  const localhostRefs = [...localhostInApps, ...localhostInLibs];

  mockReport.localhostReferences = localhostRefs;

  if (localhostRefs.length > 0) {
    console.log(`${YELLOW}⚠️  Warning: Localhost references found:${NC}`);
    localhostRefs.slice(0, 10).forEach(match => {
      console.log(`   ${match.file}:${match.line}: ${match.content}`);
    });
    warnings++;
  } else {
    console.log(`${GREEN}✅ No localhost references found${NC}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Generate detailed report
  // ─────────────────────────────────────────────────────────────────────────────
  await generateReport();

  // ─────────────────────────────────────────────────────────────────────────────
  // Summary with strict mode handling
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════════════════');
  console.log(`📋 Enhanced Detection Summary ${strictMode ? '(STRICT MODE)' : ''}`);
  console.log('═══════════════════════════════════════════════════════════════════════════');

  if (errors > 0) {
    console.log(`${RED}❌ Check FAILED with ${errors} critical error(s) and ${warnings} warning(s)${NC}`);
    console.log('\n🚨 CRITICAL: Mock files/patterns in production code will cause deployment issues.');
    console.log('📋 Action Required: Remove or relocate all mock code before deploying.');
    console.log('📄 See mock-detection-report.json for detailed analysis.');
    process.exit(1);
  } else if (warnings > 0) {
    if (strictMode) {
      console.log(`${RED}❌ STRICT MODE: Check FAILED with ${warnings} warning(s)${NC}`);
      console.log('\n🚨 STRICT MODE: All warnings must be resolved for production builds.');
      console.log('📋 Action Required: Address all warnings before production deployment.');
      console.log('📄 See mock-detection-report.json for detailed analysis.');
      process.exit(1);
    } else {
      console.log(`${YELLOW}⚠️  Check PASSED with ${warnings} warning(s)${NC}`);
      console.log('\n💡 Recommendation: Address warnings before production deployment.');
      console.log('📄 See mock-detection-report.json for detailed analysis.');
      process.exit(0);
    }
  } else {
    console.log(`${GREEN}✅ All enhanced checks PASSED - Production ready!${NC}`);
    console.log('📄 Clean report saved to mock-detection-report.json');
    process.exit(0);
  }
}

main().catch(err => {
  console.error(`${RED}Script error: ${err.message}${NC}`);
  process.exit(1);
});
