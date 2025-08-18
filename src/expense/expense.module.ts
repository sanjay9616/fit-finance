import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ExpenseGoal, ExpenseGoalSchema } from 'src/expense-goal/expense-goal.schema';
import { ExpenseController } from './expense.controller';
import { Expense, ExpenseSchema } from './expense.schema';
import { ExpenseService } from './expense.service';

@Module({
    imports: [MongooseModule.forFeature([
        { name: Expense.name, schema: ExpenseSchema },
        { name: ExpenseGoal.name, schema: ExpenseGoalSchema }
    ])],
    controllers: [ExpenseController],
    providers: [ExpenseService],
})
export class ExpenseModule { }
