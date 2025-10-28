import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Expense, ExpenseSchema } from 'src/expense/expense.schema';
import { ExpenseGoalController } from './expense-goal.controller';
import { ExpenseGoal, ExpenseGoalSchema } from './expense-goal.schema';
import { ExpenseGoalService } from './expense-goal.service';

@Module({
    imports: [MongooseModule.forFeature([
        { name: ExpenseGoal.name, schema: ExpenseGoalSchema },
        { name: Expense.name, schema: ExpenseSchema },
    ])],
    controllers: [ExpenseGoalController],
    providers: [ExpenseGoalService],
})
export class ExpenseGoalModule { }
