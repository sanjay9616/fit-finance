import { Controller, Post, Body, Res, Get, Patch, Param, Delete, Query } from '@nestjs/common';
import { ExpenseService } from './expense.service';
import { CreateExpenseDto } from 'config/interfaces';
import { Response } from 'express';

@Controller('expense')
export class ExpenseController {

  constructor(private readonly expenseService: ExpenseService) { }

  @Post(':userId')
  async getUserExpenses(@Res() res: Response, @Param('userId') userId: number, @Body('from') from?: number, @Body('to') to?: number, @Body('categoryId') categoryId?: number): Promise<void> {
    await this.expenseService.getUserExpenses(res, { userId, from, to, categoryId });
  }

  @Post()
  async createExpense(@Body() createExpenseDto: CreateExpenseDto, @Res() res: Response): Promise<void> {
    await this.expenseService.createExpense(createExpenseDto, res);
  }

  @Patch(':id')
  async updateExpense(@Param('id') id: string, @Body() updateExpenseDto: Partial<CreateExpenseDto>, @Res() res: Response): Promise<void> {
    await this.expenseService.updateExpense(id, updateExpenseDto, res);
  }

  @Delete(':id')
  async deleteExpense(@Param('id') id: string, @Res() res: Response): Promise<void> {
    await this.expenseService.deleteExpense(id, res);
  }

  @Get('current-month-expense-goals-by-category/:userId')
  async getCurrentMonthExpenseGoalsByCategory(@Param('userId') userId: number, @Query('categoryId') categoryId: number, @Query('createdAt') createdAt: number, @Res() res: Response): Promise<void> {
    await this.expenseService.getCurrentMonthExpenseGoalsByCategory(userId, categoryId, createdAt, res);
  }

  @Get('current-month-category-list/:id')
  async getCurrentMonthCategoryList(@Param('id') id: string, @Query('search') search: string, @Query('createdAt') createdAt: number, @Res() res: Response): Promise<void> {
    await this.expenseService.getCurrentMonthCategoryList(id, search, createdAt, res);
  }

  @Get('all-unique-category-list/:userId')
  async getAllUniqueCategoryList(@Param('userId') userId: string, @Res() res: Response): Promise<void> {
    await this.expenseService.getAllUniqueCategoryList(userId, res);
  }
}
