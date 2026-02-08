"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const client_1 = require("@prisma/client");
const config_1 = require("@nestjs/config");
const argon2 = __importStar(require("argon2"));
let AuthService = AuthService_1 = class AuthService {
    constructor(prisma, jwtService, configService) {
        Object.defineProperty(this, "prisma", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: prisma
        });
        Object.defineProperty(this, "jwtService", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: jwtService
        });
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
            value: new common_1.Logger(AuthService_1.name)
        });
    }
    async login(loginDto) {
        try {
            const user = await this.prisma.user.findFirst({
                where: {
                    email: loginDto.email.toLowerCase(),
                    is_active: true,
                    tenant: {
                        slug: loginDto.tenant_slug || 'default',
                        status: 'ACTIVE',
                    },
                },
                include: {
                    tenant: true,
                },
            });
            if (!user) {
                throw new common_1.UnauthorizedException('Invalid credentials');
            }
            const isPasswordValid = await argon2.verify(user.password, loginDto.password);
            if (!isPasswordValid) {
                throw new common_1.UnauthorizedException('Invalid credentials');
            }
            const tokens = await this.generateTokens(user);
            await this.prisma.user.update({
                where: { id: user.id },
                data: {
                    last_login: new Date(),
                    login_count: { increment: 1 },
                },
            });
            return {
                ...tokens,
                user: {
                    id: user.id,
                    email: user.email,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    roles: user.roles,
                },
                tenant: {
                    id: user.tenant.id,
                    slug: user.tenant.slug,
                    name: user.tenant.name,
                },
            };
        }
        catch (error) {
            if (error instanceof common_1.UnauthorizedException) {
                throw error;
            }
            this.logger.error('Login failed', error);
            throw new common_1.UnauthorizedException('Authentication failed');
        }
    }
    async register(registerDto) {
        try {
            const tenant = await this.prisma.tenant.findFirst({
                where: {
                    slug: registerDto.tenant_slug,
                    status: 'ACTIVE',
                },
            });
            if (!tenant) {
                throw new common_1.UnauthorizedException('Invalid tenant');
            }
            const existingUser = await this.prisma.user.findFirst({
                where: {
                    email: registerDto.email.toLowerCase(),
                    tenant_id: tenant.id,
                },
            });
            if (existingUser) {
                throw new common_1.UnauthorizedException('User already exists');
            }
            const hashedPassword = await argon2.hash(registerDto.password);
            const user = await this.prisma.user.create({
                data: {
                    tenant_id: tenant.id,
                    email: registerDto.email.toLowerCase(),
                    password: hashedPassword,
                    first_name: registerDto.first_name,
                    last_name: registerDto.last_name,
                    roles: ['USER'],
                    is_active: true,
                },
                include: {
                    tenant: true,
                },
            });
            const tokens = await this.generateTokens(user);
            return {
                ...tokens,
                user: {
                    id: user.id,
                    email: user.email,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    roles: user.roles,
                },
                tenant: {
                    id: user.tenant.id,
                    slug: user.tenant.slug,
                    name: user.tenant.name,
                },
            };
        }
        catch (error) {
            if (error instanceof common_1.UnauthorizedException) {
                throw error;
            }
            this.logger.error('Registration failed', error);
            throw new common_1.UnauthorizedException('Registration failed');
        }
    }
    async refreshToken(refreshToken) {
        try {
            const payload = this.jwtService.verify(refreshToken, {
                secret: this.configService.get('JWT_REFRESH_SECRET'),
            });
            const user = await this.prisma.user.findFirst({
                where: {
                    id: payload.sub,
                    is_active: true,
                },
                include: {
                    tenant: true,
                },
            });
            if (!user || user.tenant.status !== 'ACTIVE') {
                throw new common_1.UnauthorizedException('Invalid refresh token');
            }
            const accessToken = this.jwtService.sign({
                sub: user.id,
                email: user.email,
                tenant_id: user.tenant_id,
                roles: user.roles,
            });
            return { access_token: accessToken };
        }
        catch (error) {
            this.logger.error('Token refresh failed', error);
            throw new common_1.UnauthorizedException('Invalid refresh token');
        }
    }
    async generateTokens(user) {
        const payload = {
            sub: user.id,
            email: user.email,
            tenant_id: user.tenant_id,
            roles: user.roles,
        };
        const [access_token, refresh_token] = await Promise.all([
            this.jwtService.signAsync(payload),
            this.jwtService.signAsync(payload, {
                secret: this.configService.get('JWT_REFRESH_SECRET'),
                expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION', '7d'),
            }),
        ]);
        return { access_token, refresh_token };
    }
    async validateUser(userId, tenantId) {
        return this.prisma.user.findFirst({
            where: {
                id: userId,
                tenant_id: tenantId,
                is_active: true,
            },
            select: {
                id: true,
                email: true,
                roles: true,
                first_name: true,
                last_name: true,
            },
        });
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [Object, jwt_1.JwtService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map