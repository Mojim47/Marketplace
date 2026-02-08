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
var ValidationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZodValidationPipe = exports.ValidationService = void 0;
const common_1 = require("@nestjs/common");
const zod_1 = require("zod");
const dompurify_1 = __importDefault(require("dompurify"));
const jsdom_1 = require("jsdom");
const PERSIAN_ERRORS = {
    invalid_type: 'نوع داده نامعتبر است',
    invalid_literal: 'مقدار نامعتبر است',
    custom: 'خطای اعتبارسنجی',
    invalid_union: 'هیچ‌کدام از گزینه‌های معتبر نیست',
    invalid_union_discriminator: 'مقدار تشخیص‌دهنده نامعتبر است',
    invalid_enum_value: 'مقدار انتخابی نامعتبر است',
    unrecognized_keys: 'فیلدهای ناشناخته وجود دارد',
    invalid_arguments: 'آرگومان‌های نامعتبر',
    invalid_return_type: 'نوع بازگشتی نامعتبر',
    invalid_date: 'تاریخ نامعتبر است',
    invalid_string: 'رشته نامعتبر است',
    too_small: 'مقدار کوچک‌تر از حد مجاز است',
    too_big: 'مقدار بزرگ‌تر از حد مجاز است',
    invalid_intersection_types: 'نوع‌های متقاطع نامعتبر',
    not_multiple_of: 'مقدار مضربی از عدد مشخص شده نیست',
    not_finite: 'مقدار باید محدود باشد',
};
const PERSIAN_STRING_ERRORS = {
    email: 'آدرس ایمیل نامعتبر است',
    url: 'آدرس وب نامعتبر است',
    emoji: 'ایموجی نامعتبر است',
    uuid: 'شناسه UUID نامعتبر است',
    cuid: 'شناسه CUID نامعتبر است',
    cuid2: 'شناسه CUID2 نامعتبر است',
    ulid: 'شناسه ULID نامعتبر است',
    regex: 'الگوی متن نامعتبر است',
    includes: 'متن شامل مقدار مورد نظر نیست',
    startsWith: 'متن با مقدار مورد نظر شروع نمی‌شود',
    endsWith: 'متن با مقدار مورد نظر پایان نمی‌یابد',
    datetime: 'تاریخ و زمان نامعتبر است',
    ip: 'آدرس IP نامعتبر است',
};
let ValidationService = ValidationService_1 = class ValidationService {
    constructor() {
        Object.defineProperty(this, "logger", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new common_1.Logger(ValidationService_1.name)
        });
        Object.defineProperty(this, "domPurify", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "securityConfig", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "sqlPatterns", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: [
                /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b)/gi,
                /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
                /('|(\\')|(;)|(--)|(\s)|(\/\*)|(\*\/))/gi,
                /(INFORMATION_SCHEMA|SYSOBJECTS|SYSCOLUMNS)/gi,
                /(\bUNION\b.*\bSELECT\b)/gi,
                /(\b(WAITFOR|DELAY)\b)/gi,
            ]
        });
        Object.defineProperty(this, "xssPatterns", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: [
                /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
                /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
                /javascript:/gi,
                /on\w+\s*=/gi,
                /<img[^>]+src[\\s]*=[\\s]*["\']javascript:/gi,
                /expression\s*\(/gi,
            ]
        });
        Object.defineProperty(this, "pathTraversalPatterns", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: [
                /\.\.[\/\\]/g,
                /\.\.[\\\/]/g,
                /%2e%2e[\/\\]/gi,
                /%252e%252e[\/\\]/gi,
                /\.\.%2f/gi,
                /\.\.%5c/gi,
            ]
        });
        Object.defineProperty(this, "commandInjectionPatterns", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: [
                /[;&|`$(){}[\]]/g,
                /\b(cat|ls|pwd|whoami|id|uname|ps|netstat|ifconfig|ping|wget|curl|nc|telnet|ssh|ftp)\b/gi,
                /(\||&&|;|`|\$\(|\${)/g,
            ]
        });
        const window = new jsdom_1.JSDOM('').window;
        this.domPurify = (0, dompurify_1.default)(window);
        this.securityConfig = {
            enableSQLInjectionProtection: true,
            enableXSSProtection: true,
            enablePathTraversalProtection: true,
            enableCommandInjectionProtection: true,
            maxStringLength: 10000,
            maxArrayLength: 1000,
            maxObjectDepth: 10,
            allowedFileExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.doc', '.docx', '.glb', '.usdz'],
            blockedPatterns: [
                /eval\s*\(/gi,
                /Function\s*\(/gi,
                /setTimeout\s*\(/gi,
                /setInterval\s*\(/gi,
            ],
        };
    }
    validate(schema, data) {
        try {
            const result = schema.parse(data);
            return { success: true, data: result };
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                return {
                    success: false,
                    errors: this.formatErrors(error),
                };
            }
            throw error;
        }
    }
    validateOrThrow(schema, data) {
        const result = this.validate(schema, data);
        if (!result.success) {
            throw new common_1.BadRequestException({
                statusCode: 400,
                error: 'Validation Error',
                message: 'اعتبارسنجی ناموفق بود',
                details: result.errors,
            });
        }
        return result.data;
    }
    safeParse(schema, data) {
        return schema.safeParse(data);
    }
    formatErrors(error) {
        return error.issues.map((issue) => this.formatIssue(issue));
    }
    formatIssue(issue) {
        const field = issue.path.join('.');
        const code = issue.code;
        let messageFA = PERSIAN_ERRORS[code] ?? 'خطای اعتبارسنجی';
        if (code === 'invalid_string' && 'validation' in issue) {
            const validation = issue.validation;
            messageFA = PERSIAN_STRING_ERRORS[validation] ?? messageFA;
        }
        if (code === 'too_small' || code === 'too_big') {
            const minimum = 'minimum' in issue ? issue.minimum : undefined;
            const maximum = 'maximum' in issue ? issue.maximum : undefined;
            if (minimum !== undefined) {
                messageFA = `مقدار باید حداقل ${minimum} باشد`;
            }
            if (maximum !== undefined) {
                messageFA = `مقدار باید حداکثر ${maximum} باشد`;
            }
        }
        return {
            field,
            message: issue.message,
            messageFA,
            code,
        };
    }
    async validateAndSanitize(data, fieldName = 'input') {
        const violations = [];
        let riskScore = 0;
        let sanitizedValue = data;
        try {
            if (this.securityConfig.enableSQLInjectionProtection) {
                const sqlViolations = this.detectSQLInjection(data, fieldName);
                violations.push(...sqlViolations);
            }
            if (this.securityConfig.enableXSSProtection) {
                const { violations: xssViolations, sanitized } = this.detectAndSanitizeXSS(data, fieldName);
                violations.push(...xssViolations);
                sanitizedValue = sanitized;
            }
            if (this.securityConfig.enablePathTraversalProtection) {
                const pathViolations = this.detectPathTraversal(data, fieldName);
                violations.push(...pathViolations);
            }
            if (this.securityConfig.enableCommandInjectionProtection) {
                const cmdViolations = this.detectCommandInjection(data, fieldName);
                violations.push(...cmdViolations);
            }
            riskScore = violations.reduce((score, violation) => {
                const severityScore = { low: 1, medium: 3, high: 7, critical: 10 };
                return score + severityScore[violation.severity];
            }, 0);
            const isValid = violations.filter(v => v.blocked).length === 0;
            return {
                isValid,
                sanitizedValue,
                violations,
                riskScore,
            };
        }
        catch (error) {
            this.logger.error('Security validation error:', error);
            return {
                isValid: false,
                violations: [{
                        type: 'malformed_data',
                        severity: 'high',
                        field: fieldName,
                        originalValue: data,
                        description: 'Security validation failed',
                        blocked: true,
                    }],
                riskScore: 10,
            };
        }
    }
    detectSQLInjection(data, fieldName) {
        const violations = [];
        if (typeof data === 'string') {
            for (const pattern of this.sqlPatterns) {
                if (pattern.test(data)) {
                    violations.push({
                        type: 'sql_injection',
                        severity: 'critical',
                        field: fieldName,
                        originalValue: data,
                        description: 'Potential SQL injection detected',
                        blocked: true,
                    });
                    break;
                }
            }
        }
        return violations;
    }
    detectAndSanitizeXSS(data, fieldName) {
        const violations = [];
        let sanitized = data;
        if (typeof data === 'string') {
            for (const pattern of this.xssPatterns) {
                if (pattern.test(data)) {
                    violations.push({
                        type: 'xss',
                        severity: 'high',
                        field: fieldName,
                        originalValue: data,
                        description: 'Potential XSS detected and sanitized',
                        blocked: false,
                    });
                    break;
                }
            }
            sanitized = this.domPurify.sanitize(data, {
                USE_PROFILES: { html: true },
                FORBID_TAGS: ['style', 'script'],
                FORBID_ATTR: ['onerror', 'onload', 'onclick'],
            });
        }
        return { violations, sanitized };
    }
    detectPathTraversal(data, fieldName) {
        const violations = [];
        if (typeof data === 'string') {
            for (const pattern of this.pathTraversalPatterns) {
                if (pattern.test(data)) {
                    violations.push({
                        type: 'path_traversal',
                        severity: 'high',
                        field: fieldName,
                        originalValue: data,
                        description: 'Path traversal attempt detected',
                        blocked: true,
                    });
                    break;
                }
            }
        }
        return violations;
    }
    detectCommandInjection(data, fieldName) {
        const violations = [];
        if (typeof data === 'string') {
            for (const pattern of this.commandInjectionPatterns) {
                if (pattern.test(data)) {
                    violations.push({
                        type: 'command_injection',
                        severity: 'critical',
                        field: fieldName,
                        originalValue: data,
                        description: 'Command injection attempt detected',
                        blocked: true,
                    });
                    break;
                }
            }
        }
        return violations;
    }
    sanitizeHtml(html) {
        return this.domPurify.sanitize(html, {
            USE_PROFILES: { html: true },
            FORBID_TAGS: ['style', 'script'],
            FORBID_ATTR: ['onerror', 'onload', 'onclick'],
        });
    }
};
exports.ValidationService = ValidationService;
exports.ValidationService = ValidationService = ValidationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], ValidationService);
let ZodValidationPipe = class ZodValidationPipe {
    constructor(schema) {
        Object.defineProperty(this, "schema", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: schema
        });
    }
    transform(value, metadata) {
        const validationService = new ValidationService();
        return validationService.validateOrThrow(this.schema, value);
    }
};
exports.ZodValidationPipe = ZodValidationPipe;
exports.ZodValidationPipe = ZodValidationPipe = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [zod_1.ZodSchema])
], ZodValidationPipe);
//# sourceMappingURL=validation.service.js.map