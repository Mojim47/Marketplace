import { Module, Global } from '@nestjs/common'
import { PrismaService } from './prisma.service'

/**
 * Database Module (Prisma)
 * 
 * Provides:
 * - Production-ready Prisma client
 * - Connection pooling via DATABASE_URL
 * - Query logging (dev only)
 * - Health checks
 * - Graceful shutdown hooks
 * - Transaction support
 * 
 * Usage:
 * ```typescript
 * constructor(private prisma: PrismaService) {}
 * 
 * async findUser(id: string) {
 *   return this.prisma.user.findUnique({ where: { id } })
 * }
 * ```
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService]
})
export class DatabaseModule {}
