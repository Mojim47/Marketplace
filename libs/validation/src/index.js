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
exports.ValidationService = void 0;
__exportStar(require('./validation.module'), exports);
const validation_service_1 = require('./validation.service');
Object.defineProperty(exports, 'ValidationService', {
  enumerable: true,
  get: () => validation_service_1.ValidationService,
});
__exportStar(require('./schemas/product.schema'), exports);
__exportStar(require('./schemas/payment.schema'), exports);
__exportStar(require('./schemas/order.schema'), exports);
__exportStar(require('./pipes/zod-validation.pipe'), exports);
__exportStar(require('./decorators/validate.decorator'), exports);
//# sourceMappingURL=index.js.map
