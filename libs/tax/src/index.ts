export class TaxService {
  async calculate(..._args: any[]): Promise<any> {
    return {};
  }
}

export class MockTaxStrategy {
  async generateReport(..._args: any[]): Promise<any> {
    return {};
  }
}

export class IranTaxReportStrategy extends MockTaxStrategy {}
export class SenaClient {}
export class SenaIntegrationService {}
export class SenaRepo {}
export class SenaSubmission {}
export class TaxReport {}
export class TaxReportGenerator {}

