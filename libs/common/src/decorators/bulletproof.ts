import { Logger } from '@nestjs/common';

export function Bulletproof(fallbackValue: any = null) {
  return function (_target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error: any) {
        Logger.error(
          `🛡️ [BULLETPROOF] Shielded crash in ${propertyKey}: ${error?.message ?? error}`
        );
        return fallbackValue;
      }
    };
    return descriptor;
  };
}
