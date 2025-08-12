import { Controller, Get } from '@nestjs/common';
import { getSystemInfoJson } from './utils/systemInfo';

@Controller()
export class AppController {
  constructor() {}

  @Get()
  getHello() {
    return {
      success: true,
      message: 'Server is operational',
      meta: {
        system: getSystemInfoJson(),
      },
    };
  }
}
