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
const __metadata =
  (this && this.__metadata) ||
  ((k, v) => {
    if (typeof Reflect === 'object' && typeof Reflect.metadata === 'function') {
      return Reflect.metadata(k, v);
    }
  });
let JwtStrategy_1;
Object.defineProperty(exports, '__esModule', { value: true });
exports.JwtStrategy = void 0;
const common_1 = require('@nestjs/common');
const passport_1 = require('@nestjs/passport');
const passport_jwt_1 = require('passport-jwt');
const _client_1 = require('@prisma/client');
const config_1 = require('@nestjs/config');
let JwtStrategy = (JwtStrategy_1 = class JwtStrategy extends (
  (0, passport_1.PassportStrategy)(passport_jwt_1.Strategy)
) {
  constructor(prisma, configService) {
    super({
      jwtFromRequest: passport_jwt_1.ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
    Object.defineProperty(this, 'prisma', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: prisma,
    });
    Object.defineProperty(this, 'configService', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: configService,
    });
    Object.defineProperty(this, 'logger', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: new common_1.Logger(JwtStrategy_1.name),
    });
  }
  async validate(payload) {
    try {
      if (!payload.sub || !payload.email || !payload.tenant_id) {
        throw new common_1.UnauthorizedException('Invalid token payload');
      }
      const user = await this.prisma.user.findFirst({
        where: {
          id: payload.sub,
          tenant_id: payload.tenant_id,
          email: payload.email,
          is_active: true,
        },
        select: {
          id: true,
          tenant_id: true,
          email: true,
          roles: true,
          is_active: true,
          first_name: true,
          last_name: true,
          last_login: true,
        },
      });
      if (!user) {
        this.logger.warn('JWT validation failed: User not found or inactive', {
          userId: payload.sub,
          email: payload.email,
          tenantId: payload.tenant_id,
        });
        throw new common_1.UnauthorizedException('User not found or inactive');
      }
      const tenant = await this.prisma.tenant.findFirst({
        where: {
          id: payload.tenant_id,
          status: 'ACTIVE',
        },
      });
      if (!tenant) {
        this.logger.warn('JWT validation failed: Tenant not active', {
          tenantId: payload.tenant_id,
        });
        throw new common_1.UnauthorizedException('Tenant not active');
      }
      this.prisma.user
        .update({
          where: { id: user.id },
          data: {
            last_login: new Date(),
            login_count: { increment: 1 },
          },
        })
        .catch((error) => {
          this.logger.error('Failed to update last login', error);
        });
      return {
        id: user.id,
        tenant_id: user.tenant_id,
        email: user.email,
        roles: user.roles,
        is_active: user.is_active,
        first_name: user.first_name,
        last_name: user.last_name,
      };
    } catch (error) {
      if (error instanceof common_1.UnauthorizedException) {
        throw error;
      }
      this.logger.error('JWT validation error', error);
      throw new common_1.UnauthorizedException('Token validation failed');
    }
  }
});
exports.JwtStrategy = JwtStrategy;
exports.JwtStrategy =
  JwtStrategy =
  JwtStrategy_1 =
    __decorate(
      [
        (0, common_1.Injectable)(),
        __metadata('design:paramtypes', [Object, config_1.ConfigService]),
      ],
      JwtStrategy
    );
//# sourceMappingURL=jwt.strategy.js.map
