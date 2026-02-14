// ═══════════════════════════════════════════════════════════════════════════
// Observability Service - Monitoring, Tracing, and Metrics
// ═══════════════════════════════════════════════════════════════════════════
const __decorate =
  (this && this.__decorate) ||
  ((decorators, target, key, desc) => {
    const c = arguments.length;
    let r =
      c < 3 ? target : desc === null ? (desc = Object.getOwnPropertyDescriptor(target, key)) : desc;
    let d;
    if (typeof Reflect === 'object' && typeof Reflect.decorate === 'function') {
      r = Reflect.decorate(decorators, target, key, desc);
    } else {
      for (let i = decorators.length - 1; i >= 0; i--) {
        if ((d = decorators[i])) {
          r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
        }
      }
    }
    return c > 3 && r && Object.defineProperty(target, key, r), r;
  });
let ObservabilityService_1;
import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
let ObservabilityService = (ObservabilityService_1 = class ObservabilityService {
  logger = new Logger(ObservabilityService_1.name);
  activeTraces = new Map();
  async startTrace(operationName, metadata) {
    const traceId = uuidv4();
    const startTime = Date.now();
    this.activeTraces.set(traceId, {
      traceId,
      operationName,
      startTime,
      metadata,
    });
    this.logger.debug(`Trace started: ${operationName}`, {
      traceId,
      metadata,
    });
    return traceId;
  }
  async endTrace(traceId, result) {
    const trace = this.activeTraces.get(traceId);
    if (!trace) {
      this.logger.warn(`Trace not found: ${traceId}`);
      return;
    }
    const endTime = Date.now();
    const duration = endTime - trace.startTime;
    this.logger.debug(`Trace completed: ${trace.operationName}`, {
      traceId,
      duration: `${duration}ms`,
      result,
    });
    // Log slow operations
    if (duration > 1000) {
      this.logger.warn(`Slow operation detected: ${trace.operationName}`, {
        traceId,
        duration: `${duration}ms`,
        metadata: trace.metadata,
      });
    }
    this.activeTraces.delete(traceId);
  }
  async recordMetric(name, value, tags) {
    this.logger.debug(`Metric recorded: ${name}`, {
      value,
      tags,
      timestamp: new Date().toISOString(),
    });
    // In a real implementation, this would send to Prometheus/Grafana
    // For now, we just log it
  }
  async recordEvent(event, data) {
    this.logger.log(`Event recorded: ${event}`, {
      data,
      timestamp: new Date().toISOString(),
    });
  }
  getActiveTraces() {
    return Array.from(this.activeTraces.values());
  }
  getTraceCount() {
    return this.activeTraces.size;
  }
  async healthCheck() {
    return {
      status: 'healthy',
      activeTraces: this.activeTraces.size,
    };
  }
});
ObservabilityService = ObservabilityService_1 = __decorate([Injectable()], ObservabilityService);
export { ObservabilityService };
//# sourceMappingURL=observability.service.js.map
