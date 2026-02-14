import { createHash, createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Injectable, Logger } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';

interface MoodianConfig {
  apiUrl: string;
  username: string;
  password: string;
  taxID: string;
  privateKeyPath: string;
}

interface InvoiceData {
  invoiceNumber: string;
  sellerTaxID: string;
  buyerTaxID: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    taxAmount: number;
  }>;
  totalAmount: number;
}

@Injectable()
export class MoodianService {
  private readonly logger = new Logger('MoodianService');
  private readonly client: AxiosInstance;
  private readonly config: MoodianConfig;
  private readonly privateKey: Buffer;

  constructor(config: MoodianConfig) {
    this.config = config;
    this.privateKey = readFileSync(config.privateKeyPath);

    this.client = axios.create({
      baseURL: config.apiUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  }

  async sendInvoice(invoice: InvoiceData): Promise<{ suid: string; referenceNumber: string }> {
    this.logger.log(`Sending invoice ${invoice.invoiceNumber} to Moodian`);

    this.validateInvoice(invoice);

    const signature = this.signData(JSON.stringify(invoice));

    try {
      const response = await this.client.post(
        '/invoice/send',
        {
          header: {
            taxID: this.config.taxID,
            timestamp: new Date().toISOString(),
            requestId: this.generateRequestId(),
          },
          body: invoice,
          signature,
        },
        {
          auth: {
            username: this.config.username,
            password: this.config.password,
          },
        }
      );

      if (!response.data.success) {
        throw new Error(`Moodian error: ${response.data.error?.message}`);
      }

      this.logger.log(`Invoice sent successfully. SUID: ${response.data.suid}`);

      return {
        suid: response.data.suid,
        referenceNumber: response.data.referenceNumber,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to send invoice: ${err.message}`);
      throw error;
    }
  }

  async getInvoiceStatus(suid: string): Promise<{
    status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
    confirmationDate?: string;
    rejectionReason?: string;
  }> {
    const response = await this.client.get(`/invoice/status/${suid}`, {
      auth: {
        username: this.config.username,
        password: this.config.password,
      },
    });

    return response.data;
  }

  async cancelInvoice(suid: string, reason: string): Promise<void> {
    await this.client.post(
      '/invoice/cancel',
      { suid, reason, timestamp: new Date().toISOString() },
      {
        auth: {
          username: this.config.username,
          password: this.config.password,
        },
      }
    );
  }

  private validateInvoice(invoice: InvoiceData): void {
    if (!invoice.sellerTaxID || invoice.sellerTaxID.length !== 14) {
      throw new Error('Invalid seller tax ID');
    }

    if (!invoice.buyerTaxID || invoice.buyerTaxID.length !== 14) {
      throw new Error('Invalid buyer tax ID');
    }

    if (!invoice.items || invoice.items.length === 0) {
      throw new Error('Invoice must have at least one item');
    }

    const calculatedTotal = invoice.items.reduce((sum, item) => {
      return sum + item.quantity * item.unitPrice + item.taxAmount;
    }, 0);

    if (Math.abs(calculatedTotal - invoice.totalAmount) > 0.01) {
      throw new Error('Total amount mismatch');
    }
  }

  private signData(data: string): string {
    const hash = createHash('sha256').update(data).digest('hex');
    const sign = createSign('RSA-SHA256');
    sign.update(hash);
    return sign.sign(this.privateKey, 'base64');
  }

  private generateRequestId(): string {
    return `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  generateQRCode(suid: string, totalAmount: number): string {
    const data = `${suid}|${totalAmount}|${Date.now()}`;
    return `https://tp.tax.gov.ir/verify?q=${Buffer.from(data).toString('base64')}`;
  }
}
