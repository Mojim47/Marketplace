import { Module } from '@nestjs/common'
import { CacheModule } from '@nestjs/cache-manager'
import { DatabaseModule } from '../database/database.module'
import { AdminController } from './admin.controller'
import { AdminService } from './admin.service'

@Module({
  imports: [
    DatabaseModule,
    CacheModule.register({
      ttl: 300000, // 5 minutes
      max: 100,
    }),
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService]
})
export class AdminModule {}
