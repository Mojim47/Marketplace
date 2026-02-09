import { describe, expect, it, vi } from 'vitest';
import { ARAsyncScheduler } from './scheduler';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('ARAsyncScheduler', () => {
  it('honors priority and concurrency', async () => {
    const started: string[] = [];
    const scheduler = new ARAsyncScheduler({
      maxConcurrent: 2,
      onMetrics: (metric) => {
        if (metric.state === 'started') started.push(metric.jobId);
      },
    });

    const slow = () => delay(50);
    const fast = () => delay(10);

    const a = scheduler.enqueue({ id: 'low', priority: 0, execute: slow });
    const b = scheduler.enqueue({ id: 'high', priority: 5, execute: fast });
    const c = scheduler.enqueue({ id: 'mid', priority: 1, execute: fast });

    await Promise.all([a.promise, b.promise, c.promise]);

    expect(started.slice(0, 2)).toContain('high'); // high priority started immediately
    expect(started[0]).toBe('high');
    expect(started.length).toBe(3);
  });

  it('allows cancellation before start', async () => {
    vi.useFakeTimers();

    const scheduler = new ARAsyncScheduler({ maxConcurrent: 1 });

    const job1 = scheduler.enqueue({ id: 'j1', execute: () => delay(100) });
    const job2 = scheduler.enqueue({ id: 'j2', execute: () => delay(50) });

    job2.cancel();

    await vi.runAllTimersAsync();

    await job1.promise;

    expect(scheduler.getQueueSize()).toBe(0);
    expect(scheduler.getRunningCount()).toBe(0);

    vi.useRealTimers();
  });

  it('drops when deadline exceeded before start', async () => {
    const drops: string[] = [];
    const scheduler = new ARAsyncScheduler({
      onDrop: (m) => drops.push(m.error || ''),
    });

    try {
      scheduler.enqueue({
        id: 'late',
        deadlineAt: Date.now() - 10,
        execute: () => delay(5),
      });
    } catch (_) {
      // enqueue may throw on overflow only; deadline handled in schedule
    }

    await delay(0);
    expect(drops).toContain('deadline_exceeded');
  });

  it('emits drop on queue overflow', () => {
    const drops: string[] = [];
    const scheduler = new ARAsyncScheduler({
      maxConcurrent: 1,
      queueLimit: 1,
      onDrop: (m) => drops.push(m.error || ''),
    });

    scheduler.enqueue({ id: 'run', execute: () => delay(50) });
    expect(() =>
      scheduler.enqueue({ id: 'overflow', execute: () => delay(5) }),
    ).toThrow();
    expect(drops).toContain('queue_overflow');
  });
});
