import { describe, expect, it } from 'vitest';
import { DistributedLockService } from './distributed-lock.service';

const createService = () => new DistributedLockService({} as any);

describe('DistributedLockService', () => {
  it('logs redlock errors', () => {
    const originalStderrWrite = process.stderr.write.bind(process.stderr);
    const originalStdoutWrite = process.stdout.write.bind(process.stdout);
    const chunks: string[] = [];

    process.stderr.write = ((chunk: any, ...args: any[]) => {
      chunks.push(String(chunk));
      return originalStderrWrite(chunk, ...args);
    }) as any;

    process.stdout.write = ((chunk: any, ...args: any[]) => {
      chunks.push(String(chunk));
      return originalStdoutWrite(chunk, ...args);
    }) as any;

    try {
      const service = createService();
      (service as any).redlock.emit('error', new Error('redlock failure'));
    } finally {
      process.stderr.write = originalStderrWrite as any;
      process.stdout.write = originalStdoutWrite as any;
    }

    expect(chunks.join('')).toContain('redlock failure');
  });
});
