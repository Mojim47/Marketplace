// ═══════════════════════════════════════════════════════════════════════════
// Moodian Service - Real Iranian Tax Authority Integration
// ═══════════════════════════════════════════════════════════════════════════

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

interface MoodianAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface MoodianInvoiceRequest {
  header: {
    taxid: string;
    indatim: number;
    indati2m: number;
    inty: number;
    inno: string;
    irtaxid?: string;
    inp: number;
    ins: number;
    tins: number;
    tob: number;
    bid: string;
    tinb: string;
    sbc: string;
    bpc: string;
    bbc: string;
  };
  body: Array<{
    sstid: string;
    sstt: string;
    am: number;
    mu: number;
    fee: number;
    cfee: number;
    cut: number;
    exr: number;
    prdis: number;
    dis: number;
    adis: number;
    vra: number;
    vam: number;
    odt: number;
    odr: number;
    odam: number;
    olt: number;
    olr: number;
    olam: number;
    consfee: number;
    spro: number;
    bros: number;
    tcpbs: number;
    cop: number;
    vop: number;
    bsrn: string;
    tsstam: number;
  }>;
  payments: Array<{
    iinn: string;
    acn: string;
    trmn: string;
    trn: string;
    pcn: string;
    pid: string;
    pdt: number;
    pv: number;
  }>;
}

interface MoodianInvoiceResponse {
  success: boolean;
  uid?: string;
  referenceNumber?: string;
  error?: string;
  validationErrors?: string[];
}

@Injectable()
export class MoodianService {
  private readonly logger = new Logger(MoodianService.name);
  private readonly httpClient: AxiosInstance;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl: string;
  private readonly taxId: string;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('MOODIAN_CLIENT_ID')!;
    this.clientSecret = this.configService.get<string>('MOODIAN_CLIENT_SECRET')!;
    this.baseUrl = this.configService.get<string>('MOODIAN_BASE_URL', 'https://api.moodian.ir');
    this.taxId = this.configService.get<string>('MOODIAN_TAX_ID')!;

    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Request interceptor for authentication
    this.httpClient.interceptors.request.use(
      async (config) => {
        // Skip auth for token endpoint
        if (!config.url?.includes('/oauth/token')) {
          await this.ensureValidToken();
          if (this.accessToken) {
            config.headers.Authorization = `Bearer ${this.accessToken}`;
          }
        }

        this.logger.debug(`Moodian API Request: ${config.method?.toUpperCase()} ${config.url}`, {
          hasAuth: !!config.headers.Authorization,
        });
        
        return config;
      },
      (error) => {
        this.logger.error('Moodian API Request Error', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging and error handling
    this.httpClient.interceptors.response.use(
      (response) => {
        this.logger.debug(`Moodian API Response: ${response.status}`, {
          data: response.data,
        });
        return response;
      },
      (error) => {
        this.logger.error('Moodian API Response Error', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });
        
        // Handle token expiration
        if (error.response?.status === 401) {
          this.accessToken = null;
          this.tokenExpiresAt = 0;
        }
        
        return Promise.reject(error);
      }
    );
  }

  private async ensureValidToken(): Promise<void> {
    const now = Date.now();
    
    // Check if token is still valid (with 5 minute buffer)
    if (this.accessToken && this.tokenExpiresAt > now + 300000) {
      return;
    }

    try {
      const response = await this.httpClient.post<MoodianAuthResponse>('/oauth/token', {
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiresAt = now + (response.data.expires_in * 1000);

      this.logger.log('Moodian access token refreshed', {
        expiresIn: response.data.expires_in,
      });

    } catch (error) {
      this.logger.error('Failed to get Moodian access token', error);
      throw new BadRequestException('Failed to authenticate with tax authority');
    }
  }

  async submitInvoice(invoiceData: MoodianInvoiceRequest): Promise<MoodianInvoiceResponse> {
    try {
      // Validate required fields
      this.validateInvoiceData(invoiceData);

      const response = await this.httpClient.post('/api/v1/invoice/submit', invoiceData);

      if (response.data.success) {
        return {
          success: true,
          uid: response.data.uid,
          referenceNumber: response.data.referenceNumber,
        };
      } else {
        return {
          success: false,
          error: response.data.error || 'Invoice submission failed',
          validationErrors: response.data.validationErrors,
        };
      }

    } catch (error) {
      this.logger.error('Moodian invoice submission error', error);
      
      if (error instanceof BadRequestException) {
        throw error;
      }

      return {
        success: false,
        error: 'Failed to submit invoice to tax authority',
      };
    }
  }

  async getInvoiceStatus(uid: string): Promise<any> {
    try {
      const response = await this.httpClient.get(`/api/v1/invoice/status/${uid}`);
      return {
        success: true,
        data: response.data,
      };

    } catch (error) {
      this.logger.error('Moodian invoice status inquiry error', error);
      return {
        success: false,
        error: 'Failed to get invoice status',
      };
    }
  }

  async cancelInvoice(uid: string): Promise<any> {
    try {
      const response = await this.httpClient.post(`/api/v1/invoice/cancel/${uid}`);
      return {
        success: true,
        data: response.data,
      };

    } catch (error) {
      this.logger.error('Moodian invoice cancellation error', error);
      return {
        success: false,
        error: 'Failed to cancel invoice',
      };
    }
  }

  // Helper method to create invoice from order data
  createInvoiceFromOrder(orderData: any): MoodianInvoiceRequest {
    const now = Date.now();
    
    return {
      header: {
        taxid: this.taxId,
        indatim: now,
        indati2m: now,
        inty: 1, // Sales invoice
        inno: orderData.order_number,
        inp: 1, // Cash payment
        ins: 1, // Normal invoice
        tins: 1, // Subject to tax
        tob: 1, // B2C transaction
        bid: orderData.user.id,
        tinb: orderData.user.tax_id || '',
        sbc: orderData.user.postal_code || '',
        bpc: orderData.user.postal_code || '',
        bbc: orderData.user.city || '',
      },
      body: orderData.items.map((item: any) => ({
        sstid: item.product.sku,
        sstt: item.product.name,
        am: item.quantity,
        mu: 1, // Unit
        fee: item.unit_price,
        cfee: item.unit_price,
        cut: 0, // No discount
        exr: 1, // Exchange rate
        prdis: 0, // Pre-discount
        dis: 0, // Discount
        adis: 0, // Additional discount
        vra: 9, // VAT rate (9% for Iran)
        vam: item.total_price * 0.09, // VAT amount
        odt: 0, // Other deductions type
        odr: 0, // Other deductions rate
        odam: 0, // Other deductions amount
        olt: 0, // Other levies type
        olr: 0, // Other levies rate
        olam: 0, // Other levies amount
        consfee: 0, // Construction fee
        spro: 0, // Special product
        bros: 0, // Broker service
        tcpbs: 0, // Third party broker service
        cop: 0, // Commission on purchase
        vop: 0, // Value of purchase
        bsrn: '', // Broker service reference number
        tsstam: item.total_price + (item.total_price * 0.09), // Total amount including tax
      })),
      payments: [{
        iinn: orderData.order_number,
        acn: '', // Account number
        trmn: '', // Terminal number
        trn: '', // Transaction reference number
        pcn: '', // Payment card number
        pid: orderData.payment?.gateway_ref || '',
        pdt: now,
        pv: orderData.total,
      }],
    };
  }

  private validateInvoiceData(data: MoodianInvoiceRequest): void {
    if (!data.header.taxid) {
      throw new BadRequestException('Tax ID is required');
    }

    if (!data.header.inno) {
      throw new BadRequestException('Invoice number is required');
    }

    if (!data.body || data.body.length === 0) {
      throw new BadRequestException('Invoice items are required');
    }

    // Validate each item
    for (const item of data.body) {
      if (!item.sstid) {
        throw new BadRequestException('Product SKU is required for all items');
      }
      if (!item.sstt) {
        throw new BadRequestException('Product name is required for all items');
      }
      if (item.am <= 0) {
        throw new BadRequestException('Quantity must be greater than 0');
      }
      if (item.fee <= 0) {
        throw new BadRequestException('Unit price must be greater than 0');
      }
    }
  }

  // Utility method to check if service is configured
  isConfigured(): boolean {
    return !!(
      this.clientId && 
      this.clientSecret && 
      this.taxId &&
      this.clientId !== 'CHANGE_IN_PRODUCTION' &&
      this.clientSecret !== 'CHANGE_IN_PRODUCTION' &&
      this.taxId !== 'CHANGE_IN_PRODUCTION'
    );
  }

  // Get configuration info for debugging
  getConfig() {
    return {
      clientId: this.clientId ? `${this.clientId.substring(0, 8)}...` : 'Not configured',
      taxId: this.taxId ? `${this.taxId.substring(0, 4)}...` : 'Not configured',
      baseUrl: this.baseUrl,
      configured: this.isConfigured(),
      hasToken: !!this.accessToken,
      tokenExpiresAt: new Date(this.tokenExpiresAt).toISOString(),
    };
  }
}