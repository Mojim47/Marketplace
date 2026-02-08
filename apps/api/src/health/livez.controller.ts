import { Controller, Get } from '@nestjs/common';

@Controller('livez')
export class LivezController {
  @Get()
  livez() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
