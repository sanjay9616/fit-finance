import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './user/users.module';
import { ExpenseModule } from './expense/expense.module';
import { ExpenseGoalModule } from './expense-goal/expense-goal.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `.env.${process.env.NODE_ENV}`,
      isGlobal: true
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI || ''),
    UsersModule,
    ExpenseModule,
    ExpenseGoalModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
