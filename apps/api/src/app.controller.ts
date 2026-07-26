import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  health(): { status: string; service: string } {
    return { status: 'ok', service: 'balance-tributario-api' };
  }
}
