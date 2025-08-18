import { Controller, Post, Body, Res, Get, Patch, Param, Delete, Query } from '@nestjs/common';
import { ExpenseService } from './expense.service';
import { CreateExpenseDto } from 'config/interfaces';
import { Response } from 'express';

@Controller('expense')
export class ExpenseController {
  constructor(private readonly expenseService: ExpenseService) { }

  @Post()
  async createExpense(
    @Body() createExpenseDto: CreateExpenseDto,
    @Res() res: Response
  ): Promise<void> {
    await this.expenseService.createExpense(createExpenseDto, res);
  }

  @Get(':userId')
  async getAllExpenses(
    @Res() res: Response,
    @Param('userId') id: number,
    @Query('from') from?: number,
    @Query('to') to?: number
  ): Promise<void> {
    const fromDate = from ? new Date(Number(from)) : undefined;
    const toDate = to ? new Date(Number(to)) : undefined;

    await this.expenseService.getAllExpensesByUserId(res, id, fromDate, toDate);
  }


  @Patch(':id')
  async updateExpense(@Param('id') id: string, @Body() updateExpenseDto: Partial<CreateExpenseDto>, @Res() res: Response): Promise<void> {
    await this.expenseService.updateExpense(id, updateExpenseDto, res);
  }

  @Delete(':id')
  async deleteExpense(@Param('id') id: string, @Res() res: Response): Promise<void> {
    await this.expenseService.deleteExpense(id, res);
  }

  @Get('categories/:id')
  async getCategories(@Param('id') id: string, @Query('search') search: string, @Query('createdAt') createdAt: number, @Res() res: Response): Promise<void> {
    await this.expenseService.getFilteredCategories(id, search, createdAt, res);
  }

  @Get('/expense-goals/:userId')
  async getExpenseGoalsBy(@Param('userId') userId: string, @Query('category') category: string, @Query('createdAt') createdAt: number, @Res() res: Response): Promise<void> {
    await this.expenseService.getExpenseGoalsByCategory(userId, category, createdAt, res);
  }

}
