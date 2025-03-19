import { Controller, Get } from '@nestjs/common';
import axios from 'axios';

@Controller('/')
export class AppController {

  constructor() {
    console.log('MONGODB_URI:', process.env.MONGODB_URI);
  }

  @Get()
  async getTodo() {
    try {
      const response = await axios.get('https://jsonplaceholder.typicode.com/todos/2');
      return response.data;
    } catch (error) {
      return { error: "Failed to fetch data" };
    }
  }
}
