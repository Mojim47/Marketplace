// ═══════════════════════════════════════════════════════════════════════════
// File Scanner - Code Data Lake Collection Layer
// ═══════════════════════════════════════════════════════════════════════════

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import * as crypto from 'crypto';
import { CodeFile } from '../types';

export class FileScanner {
  private readonly includePatterns: string[];
  private readonly excludePatterns: string[];
  private readonly maxFileSize: number;

  constructor(
    includePatterns: string[] = ['**/*.{ts,js,tsx,jsx,py,java,go,rs,php,rb,cs,cpp,c,h}'],
    excludePatterns: string[] = [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.git/**',
      '**/coverage/**',
      '**/*.min.js',
      '**/*.bundle.js',
      '**/vendor/**',
      '**/third_party/**'
    ],
    maxFileSize: number = 1024 * 1024 // 1MB
  ) {
    this.includePatterns = includePatterns;
    this.excludePatterns = excludePatterns;
    this.maxFileSize = maxFileSize;
  }

  async scanProject(projectPath: string): Promise<CodeFile[]> {
    console.log(`🔍 Scanning project: ${projectPath}`);
    
    const files: CodeFile[] = [];
    const startTime = Date.now();

    try {
      // Find all matching files
      const filePaths = await this.findFiles(projectPath);
      console.log(`📁 Found ${filePaths.length} files to analyze`);

      // Process files in parallel with concurrency limit
      const concurrency = 10;
      const chunks = this.chunkArray(filePaths, concurrency);

      for (const chunk of chunks) {
        const chunkResults = await Promise.allSettled(
          chunk.map(filePath => this.processFile(projectPath, filePath))
        );

        for (const result of chunkResults) {
          if (result.status === 'fulfilled' && result.value) {
            files.push(result.value);
          } else if (result.status === 'rejected') {
            console.warn(`⚠️ Failed to process file: ${result.reason}`);
          }
        }
      }

      const endTime = Date.now();
      console.log(`✅ Scanned ${files.length} files in ${endTime - startTime}ms`);

      return files;
    } catch (error) {
      console.error('❌ Error scanning project:', error);
      throw error;
    }
  }

  private async findFiles(projectPath: string): Promise<string[]> {
    const allFiles: string[] = [];

    for (const pattern of this.includePatterns) {
      const matchedFiles = await glob(pattern, {
        cwd: projectPath,
        ignore: this.excludePatterns,
        nodir: true,
        absolute: false
      });
      allFiles.push(...matchedFiles);
    }

    // Remove duplicates and sort
    return [...new Set(allFiles)].sort();
  }

  private async processFile(projectPath: string, relativePath: string): Promise<CodeFile | null> {
    const fullPath = path.join(projectPath, relativePath);
    
    try {
      const stats = await fs.stat(fullPath);
      
      // Skip files that are too large
      if (stats.size > this.maxFileSize) {
        console.warn(`⚠️ Skipping large file: ${relativePath} (${stats.size} bytes)`);
        return null;
      }

      const content = await fs.readFile(fullPath, 'utf-8');
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      const language = this.detectLanguage(relativePath);

      const codeFile: CodeFile = {
        id: hash,
        path: relativePath,
        content,
        language,
        size: stats.size,
        hash,
        lastModified: stats.mtime,
        dependencies: [],
        exports: [],
        imports: [],
        functions: [],
        classes: [],
        variables: [],
        securityPatterns: []
      };

      return codeFile;
    } catch (error) {
      console.warn(`⚠️ Error processing file ${relativePath}:`, error);
      return null;
    }
  }

  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.php': 'php',
      '.rb': 'ruby',
      '.cs': 'csharp',
      '.cpp': 'cpp',
      '.cc': 'cpp',
      '.cxx': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.hpp': 'cpp',
      '.sql': 'sql',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.json': 'json',
      '.xml': 'xml',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.sass': 'sass',
      '.less': 'less',
      '.sh': 'shell',
      '.bash': 'shell',
      '.zsh': 'shell',
      '.dockerfile': 'dockerfile'
    };

    return languageMap[ext] || 'unknown';
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  async getFileStats(projectPath: string): Promise<{
    totalFiles: number;
    totalSize: number;
    languageDistribution: Record<string, number>;
    largestFiles: Array<{ path: string; size: number }>;
  }> {
    const files = await this.scanProject(projectPath);
    
    const stats = {
      totalFiles: files.length,
      totalSize: files.reduce((sum, file) => sum + file.size, 0),
      languageDistribution: {} as Record<string, number>,
      largestFiles: files
        .sort((a, b) => b.size - a.size)
        .slice(0, 10)
        .map(file => ({ path: file.path, size: file.size }))
    };

    // Calculate language distribution
    for (const file of files) {
      stats.languageDistribution[file.language] = 
        (stats.languageDistribution[file.language] || 0) + 1;
    }

    return stats;
  }
}