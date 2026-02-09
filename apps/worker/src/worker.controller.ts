import { Controller, Get } from '@nestjs/common';
import type { WorkerService } from './worker.service';

@Controller()
export class WorkerController {
  constructor(private readonly workerService?: WorkerService) {}

  @Get()
  getHello() {
    return this.workerService?.getHello?.() ?? 'Hello World!';
  }

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get('livez')
  livez() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
