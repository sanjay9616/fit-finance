import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { CreateExpenseDto } from 'config/interfaces';
import { Model } from 'mongoose';
import { Expense, ExpenseDocument } from './expense.schema';
import { Response } from 'express';
import { MESSAGE } from 'config/message';
import { ExpenseGoal, ExpenseGoalDocument } from 'src/expense-goal/expense-goal.schema';

@Injectable()
export class ExpenseService {
  constructor(
    @InjectModel(Expense.name) private expenseModel: Model<ExpenseDocument>,
    @InjectModel(ExpenseGoal.name) private expenseGoalModel: Model<ExpenseGoalDocument>,
  ) { }

  async createExpense(createExpenseDto: CreateExpenseDto, res: Response): Promise<Response> {
    try {

      const now = new Date();
      const newExpense = new this.expenseModel({ ...createExpenseDto, createdAt: now, updatedAt: now, });
      const data = await newExpense.save();

      const startOfMonth = (new Date(now.getFullYear(), now.getMonth(), 1)).getTime();
      const endOfMonth = (new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)).getTime();

      await this.expenseGoalModel.findOneAndUpdate(
        {
          userId: createExpenseDto.userId,
          category: createExpenseDto.category,
          createdAt: { $gte: startOfMonth, $lte: endOfMonth }
        },
        {
          $inc: { currentAmount: createExpenseDto.amount },
          $set: { updatedAt: now }
        },
        { new: true }
      );

      return res.status(200).json({ status: 200, success: true, message: MESSAGE.SUCCESS.EXPENSE_ADDED, data });

    } catch (error) {
      console.error('Error creating expense:', error);
      return res.status(500).json({ message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` });
    }
  }

  async getAllExpensesByUserId(res: Response, userId: number, from?: Date, to?: Date): Promise<Response> {
    try {
      const query: any = { userId };

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
      const existingExpense = await this.expenseModel.findById(id);
      if (!existingExpense) {
        return res.status(404).json({ success: false, message: MESSAGE.ERROR.EXPANSE_NOT_FOUND });
      }

      const oldAmount = existingExpense.amount;
      const newAmount = updateDto.amount !== undefined ? updateDto.amount : oldAmount;
      const difference = newAmount - oldAmount;

      const updated = await this.expenseModel.findByIdAndUpdate(
        id,
        { ...updateDto, updatedAt: Date.now() },
        { new: true }
      );

      if (existingExpense.category) {
        const expenseDate = new Date(Number(existingExpense.createdAt));
        const startOfMonth = (new Date(expenseDate.getFullYear(), expenseDate.getMonth(), 1)).getTime();
        const endOfMonth = (new Date(expenseDate.getFullYear(), expenseDate.getMonth() + 1, 0, 23, 59, 59, 999)).getTime();

        await this.expenseGoalModel.findOneAndUpdate(
          {
            category: existingExpense.category,
            userId: existingExpense.userId,
            createdAt: { $gte: startOfMonth, $lte: endOfMonth }
          },
          {
            $inc: { currentAmount: difference },
            $set: { updatedAt: new Date() }
          },
          { new: true }
        );
      }

      return res.status(200).json({ status: 200, success: true, message: MESSAGE.SUCCESS.EXPENSE_UPDATED, data: updated });

    } catch (error) {
      console.error('Error updating expense:', error);
      return res.status(500).json({ message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` });
    }
  }

  async deleteExpense(id: string, res: Response): Promise<Response> {
    try {
      const expense = await this.expenseModel.findById(id);
      if (!expense) {
        return res.status(404).json({ status: 404, success: false, message: MESSAGE.ERROR.EXPANSE_NOT_FOUND });
      }

      const { userId, category, amount, createdAt } = expense;

      const expenseDate = new Date(Number(createdAt));
      const startOfMonth = (new Date(expenseDate.getFullYear(), expenseDate.getMonth(), 1)).getTime();
      const endOfMonth = (new Date(expenseDate.getFullYear(), expenseDate.getMonth() + 1, 0, 23, 59, 59, 999)).getTime();

      await this.expenseGoalModel.findOneAndUpdate(
        {
          userId,
          category,
          createdAt: { $gte: startOfMonth, $lte: endOfMonth }
        },
        {
          $inc: { currentAmount: -amount },
          $set: { updatedAt: Date.now() }
        },
        { new: true }
      );

      await this.expenseModel.findByIdAndDelete(id);

      return res.status(200).json({ status: 200, success: true, message: MESSAGE.SUCCESS.EXPENSE_DELETED });

    } catch (error) {
      console.error('Error deleting expense:', error);
      return res.status(500).json({ status: 500, success: false, message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` });
    }
  }

  async getFilteredCategories(userId: string, search: string, createdAt: number, res: Response): Promise<Response> {
    try {
      const userIdNum = Number(userId);

      if (!createdAt) {
        return res.status(400).json({ status: 400, success: false, message: "CreatedAt timestamp is required" });
      }

      const targetDate = new Date(Number(createdAt));
      const startOfMonth = (new Date(targetDate.getFullYear(), targetDate.getMonth(), 1)).getTime();
      const endOfMonth = (new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999)).getTime();

      const searchRegex = search?.trim() ? new RegExp(search.trim(), 'i') : null;

      const userCategoriesAgg = [
        {
          $match: {
            userId: userIdNum,
            createdAt: { $gte: startOfMonth, $lte: endOfMonth }
          }
        },
        {
          $group: { _id: '$category' }
        },
        {
          $project: { _id: 0, category: '$_id' }
        }
      ];

      const userCategories = await this.expenseGoalModel.aggregate(userCategoriesAgg).exec();

      let finalList = userCategories.map(item => item.category);

      if (searchRegex) {
        finalList = finalList.filter(category => searchRegex.test(category));
      }

      return res.status(200).json({ status: 200, success: true, message: MESSAGE.SUCCESS.CATEGORY_FETCHED, data: finalList });

    } catch (error) {
      console.error('Error fetching categories:', error);
      return res.status(500).json({ status: 500, success: false, message: MESSAGE.ERROR.SOMETHING_WENT_WRONG });
    }
  }

  async getExpenseGoalsByCategory(userId: string, category: string, createdAt: number, res: Response): Promise<Response> {
    try {
      if (!userId) {
        return res.status(400).json({ status: 400, success: false, message: "User ID is required" });
      }

      if (!category) {
        return res.status(400).json({ status: 400, success: false, message: "Category is required" });
      }

      if (!createdAt) {
        return res.status(400).json({ status: 400, success: false, message: "CreatedAt timestamp is required" });
      }

      const targetDate = new Date(Number(createdAt));
      const startOfMonth = (new Date(targetDate.getFullYear(), targetDate.getMonth(), 1)).getTime();
      const endOfMonth = (new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999)).getTime();

      const goal = await this.expenseGoalModel.findOne({ userId: Number(userId), category: category.trim(), createdAt: { $gte: startOfMonth, $lte: endOfMonth } });

      if (!goal) {
        return res.status(404).json({ status: 404, success: false, message: "No expense goal found for this user, category, and month" });
      }

      return res.status(200).json({ status: 200, success: true, data: goal });

    } catch (error) {
      console.error('Error fetching expense goal:', error);
      return res.status(500).json({ status: 500, success: false, message: "Something went wrong while fetching expense goal" });
    }
  }








}
