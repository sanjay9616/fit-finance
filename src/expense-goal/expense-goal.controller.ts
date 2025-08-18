import { Controller, Post, Body, Res, Get, Patch, Param, Delete, Query } from '@nestjs/common';
import { ExpenseGoalService } from './expense-goal.service';
import { CreateExpenseGoalDto } from 'config/interfaces';
import { Response } from 'express';

@Controller('expense-goal')
export class ExpenseGoalController {
    constructor(private readonly expenseGoalService: ExpenseGoalService) { }

    @Post()
    async createExpenseGoal(
        @Body() createExpenseGoalDto: CreateExpenseGoalDto,
        @Res() res: Response
    ): Promise<void> {
        await this.expenseGoalService.createExpenseGoal(createExpenseGoalDto, res);
    }

    @Get(':userId')
    async getAllExpenseGoal(
        @Res() res: Response,
        @Param('userId') id: number,
        @Query('from') from?: number,
        @Query('to') to?: number
    ): Promise<void> {
        const fromDate = from ? Number(from) : undefined;
        const toDate = to ? Number(to) : undefined;

        await this.expenseGoalService.getAllExpenseGoalByUserId(res, id, fromDate, toDate);
    }

    @Patch(':id')
    async updateExpenseGoal(@Param('id') id: string, @Body() updateExpenseGoalDto: Partial<CreateExpenseGoalDto>, @Res() res: Response): Promise<void> {
        await this.expenseGoalService.updateExpenseGoal(id, updateExpenseGoalDto, res);
    }

    @Delete(':id')
    async deleteExpenseGoal(@Param('id') id: string, @Res() res: Response): Promise<void> {
        await this.expenseGoalService.deleteExpenseGoal(id, res);
    }
}
