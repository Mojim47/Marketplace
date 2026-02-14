const __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? (o, m, k, k2) => {
        if (k2 === undefined) {
          k2 = k;
        }
        let desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = { enumerable: true, get: () => m[k] };
        }
        Object.defineProperty(o, k2, desc);
      }
    : (o, m, k, k2) => {
        if (k2 === undefined) {
          k2 = k;
        }
        o[k2] = m[k];
      });
const __exportStar =
  (this && this.__exportStar) ||
  ((m, exports) => {
    for (const p in m) {
      if (p !== 'default' && !Object.prototype.hasOwnProperty.call(exports, p)) {
        __createBinding(exports, m, p);
      }
    }
  });
Object.defineProperty(exports, '__esModule', { value: true });
exports.getDefaultJobOptions =
  exports.getQueueConfig =
  exports.QueueModule =
  exports.QueueService =
    void 0;
const queue_service_1 = require('./queue.service');
Object.defineProperty(exports, 'QueueService', {
  enumerable: true,
  get: () => queue_service_1.QueueService,
});
const queue_module_1 = require('./queue.module');
Object.defineProperty(exports, 'QueueModule', {
  enumerable: true,
  get: () => queue_module_1.QueueModule,
});
const queue_config_1 = require('./queue.config');
Object.defineProperty(exports, 'getQueueConfig', {
  enumerable: true,
  get: () => queue_config_1.getQueueConfig,
});
Object.defineProperty(exports, 'getDefaultJobOptions', {
  enumerable: true,
  get: () => queue_config_1.getDefaultJobOptions,
});
__exportStar(require('./queue.types'), exports);
__exportStar(require('./queue.constants'), exports);
//# sourceMappingURL=index.js.map
