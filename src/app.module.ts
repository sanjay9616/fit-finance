import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './user/users.module';

const ENV = process.env.NODE_ENV || 'production'; // Default to 'qa' for local

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `.env.${ENV}`,
      isGlobal: true
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI || ''), // process.env = `.env.${ENV}` = .env.production
    UsersModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
