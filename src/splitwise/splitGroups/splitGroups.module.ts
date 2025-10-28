import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SplitGroupsController } from './splitGroups.controller';
import { SplitGroupsService } from './splitGroups.service';
import { SplitGroup, SplitGroupSchema } from './splitGroups.schema';
import { Category, CategorySchema } from 'src/category/category.schema';
import { ExpenseGoal, ExpenseGoalSchema } from 'src/expense-goal/expense-goal.schema';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: SplitGroup.name, schema: SplitGroupSchema }]),
        MongooseModule.forFeature([{ name: Category.name, schema: CategorySchema }]),
        MongooseModule.forFeature([{ name: ExpenseGoal.name, schema: ExpenseGoalSchema }]),
    ],
    controllers: [SplitGroupsController],
    providers: [SplitGroupsService],
})
export class SplitGroupsModule { }
