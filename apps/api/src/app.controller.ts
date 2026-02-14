import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import {
  Controller,
  ForbiddenException,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { type HeroAsset, HeroAssetSchema } from '../../../libs/common/src/contracts/hero.contract';
import { Bulletproof } from '../../../libs/common/src/decorators/bulletproof';
import { PrismaService } from '../../../libs/prisma/src/prisma.service';

const TARGET_ASSET_ID = 'cmlfxxjxz0006foldf4gefkav';
const HERO_CACHE_KEY = 'hero-asset-cache';
const HERO_CACHE_TTL_MS = 60_000;
const HERO_CACHE_MAX_TTL_SECONDS = 300;

export class NeonThrottlerGuard extends ThrottlerGuard {
  protected override async throwThrottlingException(_context: any): Promise<void> {
    throw new HttpException(
      {
        status: 'THROTTLED',
        theme: 'neon',
        message: 'Rate limit exceeded. Please wait before trying again.',
      },
      HttpStatus.TOO_MANY_REQUESTS
    );
  }
}

@Controller()
export class AppController {
  private readonly logger = new Logger('AppController');

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache
  ) {}

  @Get('/v1/marketplace/hero')
  @UseGuards(NeonThrottlerGuard)
  @Bulletproof({
    id: 'stub-hero',
    name: 'Lazarus Stub Asset',
    version: '1.0.0',
    spatialData: { status: 'stub' },
  } as HeroAsset)
  async getHeroAsset(@Req() req: Request): Promise<HeroAsset> {
    this.checkMaintenance();
    this.enforceOrigin(req);
    const now = Date.now();

    // Stale-while-revalidate cache
    const cached =
      (await this.cache.get<{
        data: HeroAsset;
        fetchedAt: number;
      }>(HERO_CACHE_KEY)) ?? null;

    if (cached && now - cached.fetchedAt <= HERO_CACHE_TTL_MS) {
      return cached.data;
    }

    try {
      const start = Date.now();
      const asset = await this.prisma.spatialAsset.findUnique({
        where: { id: TARGET_ASSET_ID },
      });

      const duration = Date.now() - start;
      if (duration > 200) {
        this.logger.warn(`Hero asset query exceeded 200ms (${duration}ms), returning stub.`);
        throw new Error('Latency threshold exceeded');
      }

      if (!asset) {
        throw new Error('Hero asset not found');
      }

      const parsed = HeroAssetSchema.parse({
        id: asset.id,
        name: (asset as any).title ?? asset.id,
        version: (asset as any).metadata?.version ?? '1.0.0',
        spatialData: asset.metadata ?? {},
      });

      await this.cache.set(
        HERO_CACHE_KEY,
        { data: parsed, fetchedAt: now },
        HERO_CACHE_MAX_TTL_SECONDS
      );

      return parsed;
    } catch (error: any) {
      this.logger.error(`Hero asset fetch failed: ${this.sanitize(error?.message ?? error)}`);

      if (cached) {
        this.logger.warn('Serving stale hero asset from cache due to upstream failure.');
        return cached.data;
      }

      // Bulletproof decorator handles fallback; rethrow to trigger it
      throw error;
    }
  }

  private enforceOrigin(req: any) {
    const allowed =
      process.env.FRONTEND_ORIGIN || process.env.NEXT_PUBLIC_APP_ORIGIN || 'http://localhost:3000';
    const origin = req.headers.origin ?? req.headers.referer ?? '';
    if (origin && !origin.toString().startsWith(allowed)) {
      throw new ForbiddenException({
        status: 'DENIED',
        reason: 'Untrusted origin',
        allowedOrigin: allowed,
      });
    }
  }

  private checkMaintenance() {
    if (process.env.MAINTENANCE_MODE === 'true') {
      throw new HttpException(
        {
          status: 'System Upgrading',
          theme: 'neon',
          message: 'Our nodes are syncing. Please try again shortly.',
        },
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  private sanitize(msg: string): string {
    if (!msg) return msg;
    const url = process.env.DATABASE_URL;
    return url ? msg.replace(url, '[REDACTED_DB_URL]') : msg;
  }

  // ------------------- HEALTH -------------------
  @Get('/health')
  async health() {
    this.checkMaintenance();
    const start = Date.now();
    let db = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = true;
    } catch (e: any) {
      this.logger.warn(`health db check failed: ${this.sanitize(e?.message)}`);
    }
    const latency = Date.now() - start;
    const mem = process.memoryUsage();
    const payload = {
      status: db ? 'ok' : 'degraded',
      db,
      latencyMs: latency,
      uptimeSec: Math.floor(process.uptime()),
      memory: {
        rss: mem.rss,
        heapUsed: mem.heapUsed,
      },
    };
    return payload;
  }
}
