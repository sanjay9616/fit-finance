import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';

@Controller('/')
export class AppController {

  constructor() {
    console.log('MONGODB_URI:', process.env.MONGODB_URI);
  }

  @Get()
  async rootHealth() {
    try {
      return { status: 'ok', message: 'Service is running' };
    } catch (error) {
      console.error('Root health endpoint error:', error.message);
      throw new HttpException({ status: 'error', message: 'Service unavailable' }, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
