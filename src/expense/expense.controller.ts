import { Controller, Post, Body, Res, Get, Patch, Param, Delete, Query } from '@nestjs/common';
import { ExpenseService } from './expense.service';
import { CreateExpenseDto } from 'config/interfaces';
import { Response } from 'express';

@Controller('expense')
export class ExpenseController {
  constructor(private readonly expenseService: ExpenseService) { }

  @Post(':userId')
  async getUserExpenses(@Res() res: Response, @Param('userId') userId: string | number, @Body('from') from?: number | string, @Body('to') to?: number | string, @Body('categoryId') categoryId?: number | string): Promise<void> {
    await this.expenseService.getUserExpenses(res, { userId: Number(userId), from: from ? Number(from) : undefined, to: to ? Number(to) : undefined, categoryId: categoryId ? Number(categoryId) : undefined });
  }

  @Post()
  async createExpense(@Body() createExpenseDto: CreateExpenseDto, @Res() res: Response): Promise<void> {
    const now = Date.now();
    const payload = {
      ...createExpenseDto,
      createdAt: createExpenseDto.createdAt ? Number(createExpenseDto.createdAt) : now,
      updatedAt: createExpenseDto.updatedAt ? Number(createExpenseDto.updatedAt) : now,
    };
    await this.expenseService.createExpense(payload, res);
  }

  @Patch(':id')
  async updateExpense(@Param('id') id: string, @Body() updateExpenseDto: Partial<CreateExpenseDto>, @Res() res: Response): Promise<void> {
    const payload = {
      ...updateExpenseDto,
      createdAt: updateExpenseDto.createdAt ? Number(updateExpenseDto.createdAt) : undefined,
      updatedAt: Date.now(),
    };
    await this.expenseService.updateExpense(id, payload, res);
  }

  @Delete(':id')
  async deleteExpense(@Param('id') id: string, @Res() res: Response): Promise<void> {
    await this.expenseService.deleteExpense(id, res);
  }

  @Get('current-month-expense-goals-by-category/:userId')
  async getCurrentMonthExpenseGoalsByCategory(@Param('userId') userId: string | number, @Query('categoryId') categoryId: string | number, @Query('createdAt') createdAt: string | number, @Res() res: Response): Promise<void> {
    await this.expenseService.getCurrentMonthExpenseGoalsByCategory(Number(userId), Number(categoryId), Number(createdAt), res);
  }

  @Get('current-month-category-list/:id')
  async getCurrentMonthCategoryList(@Param('id') id: string | number, @Query('search') search: string, @Query('createdAt') createdAt: string | number, @Res() res: Response): Promise<void> {
    await this.expenseService.getCurrentMonthCategoryList(Number(id), search, Number(createdAt), res);
  }

  @Get('all-unique-category-list/:userId')
  async getAllUniqueCategoryList(@Param('userId') userId: string | number, @Res() res: Response): Promise<void> {
    await this.expenseService.getAllUniqueCategoryList(Number(userId), res);
  }
}
