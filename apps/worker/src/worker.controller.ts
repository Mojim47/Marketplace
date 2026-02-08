import { Controller, Get } from '@nestjs/common';
@Controller()
export class WorkerController {
  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get('livez')
  livez() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
