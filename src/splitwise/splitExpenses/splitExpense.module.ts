import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SplitExpenseController } from './splitExpense.controller';
import { SplitExpenseService } from './splitExpense.service';
import { SplitExpense, SplitExpenseSchema } from './splitExpense.schema';
import { Category, CategorySchema } from 'src/category/category.schema';
import { ExpenseGoal, ExpenseGoalSchema } from 'src/expense-goal/expense-goal.schema';
import { Expense, ExpenseSchema } from 'src/expense/expense.schema';
import { SplitGroup, SplitGroupSchema } from '../splitGroups/splitGroups.schema';
import { User, UserSchema } from 'src/user/user.schema';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: SplitGroup.name, schema: SplitGroupSchema }]),
        MongooseModule.forFeature([{ name: SplitExpense.name, schema: SplitExpenseSchema }]),
        MongooseModule.forFeature([{ name: Category.name, schema: CategorySchema }]),
        MongooseModule.forFeature([{ name: ExpenseGoal.name, schema: ExpenseGoalSchema }]),
        MongooseModule.forFeature([{ name: Expense.name, schema: ExpenseSchema }]),
        MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    ],
    controllers: [SplitExpenseController],
    providers: [SplitExpenseService],
})
export class SplitExpenseModule { }
