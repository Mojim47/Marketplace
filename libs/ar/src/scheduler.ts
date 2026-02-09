const generateId = (): string => {
  if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
    return (crypto as any).randomUUID();
  }
  if (typeof require !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { randomUUID } = require('crypto');
    if (typeof randomUUID === 'function') return randomUUID();
  }
  return `job-${Math.random().toString(16).slice(2)}`;
};

export type ARJob<T = unknown> = {
  id?: string;
  priority?: number;
  metadata?: Record<string, any>;
  deadlineAt?: number; // epoch ms by which job must start
  execute: () => Promise<T>;
};

export type SchedulerMetrics = {
  jobId: string;
  state: 'queued' | 'started' | 'succeeded' | 'failed' | 'cancelled' | 'dropped';
  startedAt?: number;
  finishedAt?: number;
  durationMs?: number;
  error?: string;
  metadata?: Record<string, any>;
};

export type SchedulerOptions = {
  maxConcurrent?: number;
  queueLimit?: number;
  onMetrics?: (metric: SchedulerMetrics) => void;
  onDrop?: (metric: SchedulerMetrics) => void;
};

type InternalJob<T> = ARJob<T> & {
  id: string;
  enqueuedAt: number;
  cancelled?: boolean;
  resolve?: (value: T) => void;
  reject?: (err: any) => void;
};

export class ARAsyncScheduler {
  private readonly queue: InternalJob[] = [];
  private readonly running = new Set<string>();
  private readonly options: Required<SchedulerOptions>;

  constructor(options?: SchedulerOptions) {
    this.options = {
      maxConcurrent: options?.maxConcurrent ?? 2,
      queueLimit: options?.queueLimit ?? 50,
      onMetrics: options?.onMetrics ?? (() => undefined),
      onDrop: options?.onDrop ?? options?.onMetrics ?? (() => undefined),
    };
  }

  enqueue<T>(job: ARJob<T>): { jobId: string; promise: Promise<T>; cancel: () => void } {
    if (this.queue.length >= this.options.queueLimit) {
      const metric: SchedulerMetrics = {
        jobId: job.id ?? generateId(),
        state: 'dropped',
        error: 'queue_overflow',
        metadata: job.metadata,
      };
      this.emitMetric(metric);
      this.options.onDrop(metric);
      throw new Error(`Scheduler queue limit reached (${this.options.queueLimit})`);
    }

    const wrapped: InternalJob<T> = {
      ...job,
      id: job.id ?? generateId(),
      priority: job.priority ?? 0,
      enqueuedAt: Date.now(),
    };

    this.queue.push(wrapped);
    this.emitMetric({ jobId: wrapped.id, state: 'queued', metadata: wrapped.metadata });

    const promise = new Promise<T>((resolve, reject) => {
      wrapped.execute = async () => {
        if (wrapped.cancelled) {
          this.emitMetric({ jobId: wrapped.id, state: 'cancelled', metadata: wrapped.metadata });
          throw new Error('Job cancelled before start');
        }
        return job.execute();
      };

      (wrapped as any).resolve = resolve;
      (wrapped as any).reject = reject;
    });

    queueMicrotask(() => this.schedule());

    const cancel = () => {
      wrapped.cancelled = true;
      if (!this.running.has(wrapped.id)) {
        this.removeFromQueue(wrapped.id);
        this.emitMetric({ jobId: wrapped.id, state: 'cancelled', metadata: wrapped.metadata });
      }
    };

    return { jobId: wrapped.id, promise, cancel };
  }

  private removeFromQueue(jobId: string) {
    const idx = this.queue.findIndex((j) => j.id === jobId);
    if (idx >= 0) this.queue.splice(idx, 1);
  }

  private schedule() {
    while (this.running.size < this.options.maxConcurrent && this.queue.length) {
      // Highest priority first, FIFO within priority
      this.queue.sort((a, b) => b.priority - a.priority || a.enqueuedAt - b.enqueuedAt);
      const job = this.queue.shift();
      if (!job) return;
      if (job.cancelled) {
        this.emitMetric({ jobId: job.id, state: 'cancelled', metadata: job.metadata });
        continue;
      }
      const now = Date.now();
      if (job.deadlineAt && now > job.deadlineAt) {
        const metric: SchedulerMetrics = {
          jobId: job.id,
          state: 'dropped',
          error: 'deadline_exceeded',
          metadata: job.metadata,
        };
        this.emitMetric(metric);
        this.options.onDrop(metric);
        continue;
      }
      this.startJob(job);
    }
  }

  private startJob<T>(job: InternalJob<T>) {
    this.running.add(job.id);
    const startedAt = Date.now();
    this.emitMetric({ jobId: job.id, state: 'started', startedAt, metadata: job.metadata });

    job
      .execute()
      .then((result) => {
        this.emitMetric({
          jobId: job.id,
          state: 'succeeded',
          startedAt,
          finishedAt: Date.now(),
          durationMs: Date.now() - startedAt,
          metadata: job.metadata,
        });
        (job as any).resolve?.(result);
      })
      .catch((error: Error) => {
        this.emitMetric({
          jobId: job.id,
          state: 'failed',
          startedAt,
          finishedAt: Date.now(),
          durationMs: Date.now() - startedAt,
          error: error?.message ?? 'unknown error',
          metadata: job.metadata,
        });
        (job as any).reject?.(error);
      })
      .finally(() => {
        this.running.delete(job.id);
        this.schedule();
      });
  }

  private emitMetric(metric: SchedulerMetrics) {
    try {
      this.options.onMetrics(metric);
    } catch (err) {
      // Keep scheduler non-fatal
      console.warn('Telemetry hook failed', err);
    }
  }

  getQueueSize() {
    return this.queue.length;
  }

  getRunningCount() {
    return this.running.size;
  }
}
