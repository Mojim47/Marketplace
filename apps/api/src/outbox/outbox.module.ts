import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { OutboxDispatcherService } from './outbox-dispatcher.service';
import { OutboxService } from './outbox.service';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [OutboxService, OutboxDispatcherService],
  exports: [OutboxService],
})
export class OutboxModule {}
