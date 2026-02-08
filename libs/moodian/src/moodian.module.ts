// ═══════════════════════════════════════════════════════════════════════════
// Moodian Module - Iranian Tax Authority Integration Module
// ═══════════════════════════════════════════════════════════════════════════

import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Services
import { MoodianService } from './moodian.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [MoodianService],
  exports: [MoodianService],
})
export class MoodianModule {}