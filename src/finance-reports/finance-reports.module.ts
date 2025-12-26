import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FinanceReportsController } from './finance-reports.controller';
import { FinanceReportsService } from './finance-reports.service';
import { Expense, ExpenseSchema } from 'src/expense/expense.schema';
import { ExpenseGoal, ExpenseGoalSchema } from 'src/expense-goal/expense-goal.schema';
import { User, UserSchema } from 'src/user/user.schema';

import { Category, CategorySchema } from 'src/category/category.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Expense.name, schema: ExpenseSchema },
            { name: ExpenseGoal.name, schema: ExpenseGoalSchema },
            { name: User.name, schema: UserSchema },
            { name: Category.name, schema: CategorySchema }
        ])
    ],
    controllers: [FinanceReportsController],
    providers: [FinanceReportsService],
})
export class FinanceReportsModule { }
