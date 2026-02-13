declare module 'opossum';

declare module '@nextgen/waf' {
  export class WAFService {
    validateRequest(_req: unknown): Promise<void>;
  }
}

declare module '@nextgen/tax' {
  export class TaxService {
    calculate?(...args: any[]): Promise<any>;
  }
}

declare module '@nextgen/storage' {
  export { UploadFile, StorageService } from '@nextgen/storage';
}

declare module '../../../libs/payment/src/payment.service' {
  export class PaymentService {
    createPayment(input: any): Promise<any>;
  }
}

declare namespace Express {
  namespace Multer {
    interface File {
      [key: string]: any;
    }
  }
}
