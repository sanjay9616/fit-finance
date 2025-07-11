import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { CreateExpenseDto } from 'config/interfaces';
import { Model } from 'mongoose';
import { Expense, ExpenseDocument } from './expense.schema';
import { Response } from 'express';
import { MESSAGE } from 'config/message';

@Injectable()
export class ExpenseService {
  constructor(
    @InjectModel(Expense.name) private expenseModel: Model<ExpenseDocument>,
  ) { }

  async createExpense(createExpenseDto: CreateExpenseDto, res: Response): Promise<Response> {
    try {
      const now = Date.now();
      const newExpense = new this.expenseModel({
        ...createExpenseDto,
        createdAt: now,
        updatedAt: now,
      });
      const data = await newExpense.save();
      return res.status(200).json({ status: 200, success: true, message: MESSAGE.SUCCESS.EXPENSE_ADDED, data });
    } catch (error) {
      console.error('Error creating expense:', error);
      return res.status(500).json({ message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` })
    }
  }

  async getAllExpensesByUserId(res: Response, id: number, from?: Date, to?: Date): Promise<Response> {
    try {
      const query: any = { id };

      if (from && to) {
        query.createdAt = { $gte: from, $lte: to };
      } else if (from) {
        query.createdAt = { $gte: from };
      } else if (to) {
        query.createdAt = { $lte: to };
      }

      const expenses = await this.expenseModel.find(query).sort({ createdAt: -1 });

      return res.status(200).json({ status: 200, success: true, message: MESSAGE.SUCCESS.EXPENSE_FETCHED, data: expenses, });
    } catch (error) {
      console.error('Error fetching expense:', error);
      return res.status(500).json({ message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` })
    }
  }


  async updateExpense(id: string, updateDto: Partial<CreateExpenseDto>, res: Response): Promise<Response> {
    try {
      const updated = await this.expenseModel.findByIdAndUpdate(id, { ...updateDto, updatedAt: Date.now() }, { new: true });
      if (!updated) {
        return res.status(404).json({ success: false, message: MESSAGE.ERROR.EXPANSE_NOT_FOUND });
      }
      return res.status(200).json({ status: 200, success: true, message: MESSAGE.SUCCESS.EXPENSE_UPDATED, data: updated });
    } catch (error) {
      console.error('Error updating expense:', error);
      return res.status(500).json({ message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` })
    }
  }

  async deleteExpense(id: string, res: Response): Promise<Response> {
    try {
      const result = await this.expenseModel.findByIdAndDelete(id);
      if (!result) {
        return res.status(404).json({ status: 404, success: false, message: MESSAGE.ERROR.EXPANSE_NOT_FOUND });
      }
      return res.status(200).json({ status: 200, success: true, message: MESSAGE.SUCCESS.EXPENSE_DELETED, });
    } catch (error) {
      console.error('Error deleting expense:', error);
      return res.status(500).json({ message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` })
    }
  }
}
