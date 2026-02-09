// ═══════════════════════════════════════════════════════════════════════════
// Observability Module - Monitoring and Tracing Module
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
import { Global, Module } from '@nestjs/common';
import { ObservabilityService } from './observability.service';
let ObservabilityModule = class ObservabilityModule {};
ObservabilityModule = __decorate(
  [
    Global(),
    Module({
      providers: [ObservabilityService],
      exports: [ObservabilityService],
    }),
  ],
  ObservabilityModule
);
export { ObservabilityModule };
//# sourceMappingURL=observability.module.js.map
