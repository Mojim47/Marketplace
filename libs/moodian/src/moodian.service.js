"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var MoodianService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MoodianService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = __importDefault(require("axios"));
let MoodianService = MoodianService_1 = class MoodianService {
    constructor(configService) {
        Object.defineProperty(this, "configService", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: configService
        });
        Object.defineProperty(this, "logger", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new common_1.Logger(MoodianService_1.name)
        });
        Object.defineProperty(this, "httpClient", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "clientId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "clientSecret", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "baseUrl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "taxId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "accessToken", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "tokenExpiresAt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        this.clientId = this.configService.get('MOODIAN_CLIENT_ID');
        this.clientSecret = this.configService.get('MOODIAN_CLIENT_SECRET');
        this.baseUrl = this.configService.get('MOODIAN_BASE_URL', 'https://api.moodian.ir');
        this.taxId = this.configService.get('MOODIAN_TAX_ID');
        this.httpClient = axios_1.default.create({
            baseURL: this.baseUrl,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
        });
        this.httpClient.interceptors.request.use(async (config) => {
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
        }, (error) => {
            this.logger.error('Moodian API Request Error', error);
            return Promise.reject(error);
        });
        this.httpClient.interceptors.response.use((response) => {
            this.logger.debug(`Moodian API Response: ${response.status}`, {
                data: response.data,
            });
            return response;
        }, (error) => {
            this.logger.error('Moodian API Response Error', {
                status: error.response?.status,
                data: error.response?.data,
                message: error.message,
            });
            if (error.response?.status === 401) {
                this.accessToken = null;
                this.tokenExpiresAt = 0;
            }
            return Promise.reject(error);
        });
    }
    async ensureValidToken() {
        const now = Date.now();
        if (this.accessToken && this.tokenExpiresAt > now + 300000) {
            return;
        }
        try {
            const response = await this.httpClient.post('/oauth/token', {
                grant_type: 'client_credentials',
                client_id: this.clientId,
                client_secret: this.clientSecret,
            });
            this.accessToken = response.data.access_token;
            this.tokenExpiresAt = now + (response.data.expires_in * 1000);
            this.logger.log('Moodian access token refreshed', {
                expiresIn: response.data.expires_in,
            });
        }
        catch (error) {
            this.logger.error('Failed to get Moodian access token', error);
            throw new common_1.BadRequestException('Failed to authenticate with tax authority');
        }
    }
    async submitInvoice(invoiceData) {
        try {
            this.validateInvoiceData(invoiceData);
            const response = await this.httpClient.post('/api/v1/invoice/submit', invoiceData);
            if (response.data.success) {
                return {
                    success: true,
                    uid: response.data.uid,
                    referenceNumber: response.data.referenceNumber,
                };
            }
            else {
                return {
                    success: false,
                    error: response.data.error || 'Invoice submission failed',
                    validationErrors: response.data.validationErrors,
                };
            }
        }
        catch (error) {
            this.logger.error('Moodian invoice submission error', error);
            if (error instanceof common_1.BadRequestException) {
                throw error;
            }
            return {
                success: false,
                error: 'Failed to submit invoice to tax authority',
            };
        }
    }
    async getInvoiceStatus(uid) {
        try {
            const response = await this.httpClient.get(`/api/v1/invoice/status/${uid}`);
            return {
                success: true,
                data: response.data,
            };
        }
        catch (error) {
            this.logger.error('Moodian invoice status inquiry error', error);
            return {
                success: false,
                error: 'Failed to get invoice status',
            };
        }
    }
    async cancelInvoice(uid) {
        try {
            const response = await this.httpClient.post(`/api/v1/invoice/cancel/${uid}`);
            return {
                success: true,
                data: response.data,
            };
        }
        catch (error) {
            this.logger.error('Moodian invoice cancellation error', error);
            return {
                success: false,
                error: 'Failed to cancel invoice',
            };
        }
    }
    createInvoiceFromOrder(orderData) {
        const now = Date.now();
        return {
            header: {
                taxid: this.taxId,
                indatim: now,
                indati2m: now,
                inty: 1,
                inno: orderData.order_number,
                inp: 1,
                ins: 1,
                tins: 1,
                tob: 1,
                bid: orderData.user.id,
                tinb: orderData.user.tax_id || '',
                sbc: orderData.user.postal_code || '',
                bpc: orderData.user.postal_code || '',
                bbc: orderData.user.city || '',
            },
            body: orderData.items.map((item) => ({
                sstid: item.product.sku,
                sstt: item.product.name,
                am: item.quantity,
                mu: 1,
                fee: item.unit_price,
                cfee: item.unit_price,
                cut: 0,
                exr: 1,
                prdis: 0,
                dis: 0,
                adis: 0,
                vra: 9,
                vam: item.total_price * 0.09,
                odt: 0,
                odr: 0,
                odam: 0,
                olt: 0,
                olr: 0,
                olam: 0,
                consfee: 0,
                spro: 0,
                bros: 0,
                tcpbs: 0,
                cop: 0,
                vop: 0,
                bsrn: '',
                tsstam: item.total_price + (item.total_price * 0.09),
            })),
            payments: [{
                    iinn: orderData.order_number,
                    acn: '',
                    trmn: '',
                    trn: '',
                    pcn: '',
                    pid: orderData.payment?.gateway_ref || '',
                    pdt: now,
                    pv: orderData.total,
                }],
        };
    }
    validateInvoiceData(data) {
        if (!data.header.taxid) {
            throw new common_1.BadRequestException('Tax ID is required');
        }
        if (!data.header.inno) {
            throw new common_1.BadRequestException('Invoice number is required');
        }
        if (!data.body || data.body.length === 0) {
            throw new common_1.BadRequestException('Invoice items are required');
        }
        for (const item of data.body) {
            if (!item.sstid) {
                throw new common_1.BadRequestException('Product SKU is required for all items');
            }
            if (!item.sstt) {
                throw new common_1.BadRequestException('Product name is required for all items');
            }
            if (item.am <= 0) {
                throw new common_1.BadRequestException('Quantity must be greater than 0');
            }
            if (item.fee <= 0) {
                throw new common_1.BadRequestException('Unit price must be greater than 0');
            }
        }
    }
    isConfigured() {
        return !!(this.clientId &&
            this.clientSecret &&
            this.taxId &&
            this.clientId !== 'CHANGE_IN_PRODUCTION' &&
            this.clientSecret !== 'CHANGE_IN_PRODUCTION' &&
            this.taxId !== 'CHANGE_IN_PRODUCTION');
    }
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
};
exports.MoodianService = MoodianService;
exports.MoodianService = MoodianService = MoodianService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], MoodianService);
//# sourceMappingURL=moodian.service.js.map