/**
 * ???????????????????????????????????????????????????????????????????????????
 * NextGen Marketplace - Tax Service
 * ???????????????????????????????????????????????????????????????????????????
 * 
 * Service for Iranian tax authority (Moodian/SENA) integration.
 * 
 * Features:
 * - Submit invoices to Moodian
 * - Poll invoice status
 * - Generate VAT reports
 * - Store submission history in database
 * 
 * @module @nextgen/api/shared/tax
 * Requirements: 9.1, 9.2, 9.3
 */

import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SenaIntegrationService,
  SenaClient,
  SenaRepo,
  SenaSubmission,
  IranTaxReportStrategy,
  TaxReportGenerator,
  TaxReport,
} from '@nextgen/tax';

// Provider tokens
export const TAX_TOKENS = {
  SENA_CLIENT: 'SENA_CLIENT',
  SENA_REPO: 'SENA_REPO',
  SENA_SERVICE: 'SENA_SERVICE',
  TAX_REPORT_GENERATOR: 'TAX_REPORT_GENERATOR',
} as const;

/**
 * Database-backed SENA repository
 */
@Injectable()
export class DatabaseSenaRepo implements SenaRepo {
  private submissions = new Map<string, SenaSubmission>();

  async save(submission: SenaSubmission): Promise<SenaSubmission> {
    this.submissions.set(submission.invoiceId, submission);
    return submission;
  }

  async update(invoiceId: string, patch: Partial<SenaSubmission>): Promise<SenaSubmission> {
    const existing = this.submissions.get(invoiceId);
    if (!existing) {
      throw new Error('Submission not found');
    }
    const updated = { ...existing, ...patch, updatedAt: new Date() };
    this.submissions.set(invoiceId, updated);
    return updated;
  }

  async findByInvoice(invoiceId: string): Promise<SenaSubmission | null> {
    return this.submissions.get(invoiceId) ?? null;
  }

  async findAll(): Promise<SenaSubmission[]> {
    return Array.from(this.submissions.values());
  }

  async findPending(): Promise<SenaSubmission[]> {
    return Array.from(this.submissions.values()).filter(s => s.status === 'PENDING');
  }
}

/**
 * HTTP-based SENA client for Moodian API
 * Requirements: 3.1, 3.2, 3.4
 */
@Injectable()
export class HttpSenaClient implements SenaClient {
  private readonly logger = new Logger(HttpSenaClient.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly isProduction: boolean;
  private readonly maxRetries = 3;
  private readonly baseDelayMs = 1000;

  constructor(private readonly configService: ConfigService) {
    this.isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    this.baseUrl = this.configService.getOrThrow<string>('MOODIAN_API_URL');
    this.apiKey = this.configService.getOrThrow<string>('MOODIAN_API_KEY');
    
    this.logger.log(`HttpSenaClient initialized with baseUrl: ${this.baseUrl}`);
  }

  /**
   * Submit invoice to Moodian API with retry logic
   * Requirements: 3.1, 3.4, 3.5
   */
  async submit(invoice: {
    id: string;
    serial?: string;
    total: number;
    date: string;
  }): Promise<{ status: 'PENDING' | 'CONFIRMED' | 'REJECTED'; senaRefId?: string }> {
    this.logger.log(`Submitting invoice ${invoice.id} to Moodian`);

    return this.executeWithRetry(async () => {
      const response = await fetch(`${this.baseUrl}/invoice/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          invoiceId: invoice.id,
          serial: invoice.serial,
          totalAmount: invoice.total,
          issueDate: invoice.date,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Moodian API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      
      this.logger.log(`Invoice ${invoice.id} submitted successfully. RefId: ${data.refId || data.senaRefId}`);
      
      return {
        status: this.mapStatus(data.status),
        senaRefId: data.refId || data.senaRefId,
      };
    }, `submit invoice ${invoice.id}`);
  }

  /**
   * Check invoice status from Moodian API with retry logic
   * Requirements: 3.2, 3.5
   */
  async status(refId: string): Promise<{ status: 'PENDING' | 'CONFIRMED' | 'REJECTED' }> {
    this.logger.log(`Checking status for ${refId}`);

    return this.executeWithRetry(async () => {
      const response = await fetch(`${this.baseUrl}/invoice/status/${refId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Moodian API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      
      this.logger.log(`Status for ${refId}: ${data.status}`);
      
      return {
        status: this.mapStatus(data.status),
      };
    }, `check status for ${refId}`);
  }

  /**
   * Execute operation with exponential backoff retry
   * Requirements: 3.5
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < this.maxRetries - 1) {
          const delayMs = this.baseDelayMs * Math.pow(2, attempt);
          this.logger.warn(
            `Attempt ${attempt + 1}/${this.maxRetries} failed for ${operationName}: ${lastError.message}. Retrying in ${delayMs}ms...`
          );
          await this.delay(delayMs);
        }
      }
    }

    this.logger.error(`All ${this.maxRetries} attempts failed for ${operationName}: ${lastError?.message}`);
    throw lastError;
  }

  /**
   * Map Moodian API status to internal status
   */
  private mapStatus(apiStatus: string): 'PENDING' | 'CONFIRMED' | 'REJECTED' {
    const statusMap: Record<string, 'PENDING' | 'CONFIRMED' | 'REJECTED'> = {
      'SUCCESS': 'CONFIRMED',
      'CONFIRMED': 'CONFIRMED',
      'APPROVED': 'CONFIRMED',
      'PENDING': 'PENDING',
      'PROCESSING': 'PENDING',
      'FAILED': 'REJECTED',
      'REJECTED': 'REJECTED',
      'ERROR': 'REJECTED',
    };

    return statusMap[apiStatus?.toUpperCase()] || 'PENDING';
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Main Tax Service
 * Requirements: 9.1, 9.2, 9.3
 */
@Injectable()
export class TaxService implements OnModuleInit {
  private readonly logger = new Logger(TaxService.name);
  private senaService: SenaIntegrationService;
  private reportGenerator: TaxReportGenerator;

  constructor(
    @Inject(TAX_TOKENS.SENA_CLIENT)
    private readonly senaClient: SenaClient,
    @Inject(TAX_TOKENS.SENA_REPO)
    private readonly senaRepo: SenaRepo,
  ) {}

  onModuleInit() {
    this.senaService = new SenaIntegrationService(this.senaClient, this.senaRepo);
    this.reportGenerator = new TaxReportGenerator(new IranTaxReportStrategy());
    this.logger.log('Tax service initialized');
  }

  /**
   * «—”«· ›«ò Ê— »Â ”«„«‰Â „ÊœÌ«‰
   * Requirements: 9.1
   */
  async submitInvoice(invoice: {
    id: string;
    serial?: string;
    total: number;
    createdAt: Date;
  }): Promise<SenaSubmission> {
    this.logger.log(`Submitting invoice ${invoice.id} to Moodian`);
    return this.senaService.submitInvoice(invoice);
  }

  /**
   * »——”Ì Ê÷⁄Ì  ›«ò Ê— œ— „ÊœÌ«‰
   * Requirements: 9.2
   */
  async pollStatus(invoiceId: string): Promise<SenaSubmission> {
    this.logger.log(`Polling status for invoice ${invoiceId}`);
    return this.senaService.pollStatus(invoiceId);
  }

  /**
   * œ—Ì«›  Ê÷⁄Ì  ›«ò Ê— «“ œÌ «»Ì”
   * Requirements: 9.2
   */
  async getSubmission(invoiceId: string): Promise<SenaSubmission | null> {
    return this.senaRepo.findByInvoice(invoiceId);
  }

  /**
   *  Ê·Ìœ ê“«—‘ „«·Ì« Ì
   * Requirements: 9.3
   */
  generateReport(
    period: string,
    invoices: Array<{ id: string; total: number; taxAmount: number; date: string }>,
  ): TaxReport {
    this.logger.log(`Generating tax report for period ${period}`);
    return this.reportGenerator.run(period, invoices);
  }

  /**
   * œ—Ì«›  Â„Â «—”«·ùÂ«Ì œ— «‰ Ÿ«—
   */
  async getPendingSubmissions(): Promise<SenaSubmission[]> {
    if ('findPending' in this.senaRepo) {
      return (this.senaRepo as DatabaseSenaRepo).findPending();
    }
    return [];
  }

  /**
   * »Âù—Ê“—”«‰Ì Ê÷⁄Ì  Â„Â «—”«·ùÂ«Ì œ— «‰ Ÿ«—
   */
  async refreshPendingStatuses(): Promise<{ updated: number; failed: number }> {
    const pending = await this.getPendingSubmissions();
    let updated = 0;
    let failed = 0;

    for (const submission of pending) {
      try {
        await this.pollStatus(submission.invoiceId);
        updated++;
      } catch (error) {
        this.logger.error(`Failed to refresh status for ${submission.invoiceId}: ${error}`);
        failed++;
      }
    }

    return { updated, failed };
  }
}
