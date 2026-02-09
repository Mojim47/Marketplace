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
Object.defineProperty(exports, '__esModule', { value: true });
exports.PaymentModule = void 0;
const common_1 = require('@nestjs/common');
const config_1 = require('@nestjs/config');
const client_1 = require('@prisma/client');
const zarinpal_service_1 = require('./zarinpal.service');
let PaymentModule = class PaymentModule {};
exports.PaymentModule = PaymentModule;
exports.PaymentModule = PaymentModule = __decorate(
  [
    (0, common_1.Global)(),
    (0, common_1.Module)({
      imports: [config_1.ConfigModule],
      providers: [client_1.PrismaClient, zarinpal_service_1.ZarinpalService],
      exports: [zarinpal_service_1.ZarinpalService],
    }),
  ],
  PaymentModule
);
//# sourceMappingURL=payment.module.js.map
