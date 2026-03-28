import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'standit-game-server',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
