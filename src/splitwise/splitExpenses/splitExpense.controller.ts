import { Controller, Post, Body, Res, Get, Param, Put, Delete } from '@nestjs/common';
import { SettleDataDto, SplitExpenseDto } from 'config/interfaces';
import { Response } from 'express';
import { SplitExpenseService } from './splitExpense.service';

@Controller('split-expense')
export class SplitExpenseController {
    constructor(private readonly splitExpenseService: SplitExpenseService) { }

    @Get('get-expenses-by-group/:id')
    async getExpensesByGroup(@Param('id') splitGroupId: number, @Res() res: Response) {
        await this.splitExpenseService.getExpensesByGroup(splitGroupId, res);
    }

    @Post('create-expense')
    async createSplitExpense(@Body() expenseDto: SplitExpenseDto, @Res() res: Response) {
        return this.splitExpenseService.createSplitExpense(expenseDto, res);
    }

    @Put('update-expense/:id')
    async updateSplitExpense(@Param('id') splitExpenseId: number, @Body() expenseDto: SplitExpenseDto, @Res() res: Response) {
        await this.splitExpenseService.updateSplitExpense(splitExpenseId, expenseDto, res);
    }

    @Post('create-settle-up')
    async createSplitSettleUp(@Body() expenseDto: SettleDataDto, @Res() res: Response) {
        return this.splitExpenseService.createSplitSettleUp(expenseDto, res);
    }

    @Post('update-settle-up')
    async updateSplitSettleUpController(@Body() expenseDto: SettleDataDto, @Res() res: Response) {
        return this.splitExpenseService.updateSplitSettleUp(expenseDto, res);
    }

    @Delete('delete/:splitExpenseId')
    async removeExpense(@Param('splitExpenseId') splitExpenseId: string, @Res() res: Response) {
        const id = Number(splitExpenseId);
        return this.splitExpenseService.deleteExpense(id, res);
    }
}
