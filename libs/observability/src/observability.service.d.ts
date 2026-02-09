interface TraceData {
  traceId: string;
  operationName: string;
  startTime: number;
  metadata?: Record<string, any>;
}
export declare class ObservabilityService {
  private readonly logger;
  private readonly activeTraces;
  startTrace(operationName: string, metadata?: Record<string, any>): Promise<string>;
  endTrace(traceId: string, result?: Record<string, any>): Promise<void>;
  recordMetric(name: string, value: number, tags?: Record<string, string>): Promise<void>;
  recordEvent(event: string, data?: Record<string, any>): Promise<void>;
  getActiveTraces(): TraceData[];
  getTraceCount(): number;
  healthCheck(): Promise<{
    status: string;
    activeTraces: number;
  }>;
}
//# sourceMappingURL=observability.service.d.ts.map
