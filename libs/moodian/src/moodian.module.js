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
exports.MoodianModule = void 0;
const common_1 = require('@nestjs/common');
const config_1 = require('@nestjs/config');
const moodian_service_1 = require('./moodian.service');
let MoodianModule = class MoodianModule {};
exports.MoodianModule = MoodianModule;
exports.MoodianModule = MoodianModule = __decorate(
  [
    (0, common_1.Global)(),
    (0, common_1.Module)({
      imports: [config_1.ConfigModule],
      providers: [moodian_service_1.MoodianService],
      exports: [moodian_service_1.MoodianService],
    }),
  ],
  MoodianModule
);
//# sourceMappingURL=moodian.module.js.map
