import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { ensureMaskedPan } from '../payment/pan.guard'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)

  constructor() {
    super({
      log: process.env['NODE_ENV'] === 'development' 
        ? ['query', 'info', 'warn', 'error']
        : ['warn', 'error'],
      errorFormat: 'pretty',
    })

    // Global PAN redaction guard for payment_transactions
    this.$use(async (params, next) => {
      if (params.model === 'PaymentTransaction' && params.action) {
        const data: any = params.args?.data;
        if (data && data.card_pan) ensureMaskedPan(data.card_pan);
      }
      return next(params)
    })
  }

  async onModuleInit() {
    try {
      await this.$connect()
      this.logger.log('? Database connected successfully')
    } catch (error) {
      this.logger.error('? Database connection failed', error)
      throw error
    }
  }

  async onModuleDestroy() {
    await this.$disconnect()
    this.logger.log('Database disconnected')
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`
      return true
    } catch {
      return false
    }
  }
}
