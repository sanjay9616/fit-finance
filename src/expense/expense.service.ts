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

  private getMonthRange(timestamp: number) {
    const date = new Date(timestamp);
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
    return { startOfMonth, endOfMonth };
  }

  private async enrichWithCategory(expense: ExpenseDocument | any) {
    const [data] = await this.expenseModel.aggregate([
      { $match: { _id: expense._id } },
      {
        $lookup: {
          from: 'categories',
          let: { userId: '$userId', categoryId: '$categoryId' },
          pipeline: [
            {
              $match: {
                $expr: { $and: [{ $eq: ['$userId', '$$userId'] }, { $eq: ['$categoryId', '$$categoryId'] }] },
              },
            },
            { $project: { _id: 0, categoryName: 1 } },
          ],
          as: 'categoryDetails',
        },
      },
      { $addFields: { categoryName: { $arrayElemAt: ['$categoryDetails.categoryName', 0] } } },
      { $project: { categoryDetails: 0 } },
    ]);
    return data;
  }

  async getUserExpenses(res: Response, payload: { userId: number; from?: number; to?: number; categoryId?: number }): Promise<Response> {
    try {
      const { userId, from, to, categoryId } = payload;
      const match: any = { userId };
      if (from && to) match.createdAt = { $gte: from, $lte: to };
      else if (from) match.createdAt = { $gte: from };
      else if (to) match.createdAt = { $lte: to };
      if (categoryId) match.categoryId = categoryId;

      const expenses = await this.expenseModel.aggregate([
        { $match: match },
        {
          $lookup: {
            from: 'categories',
            let: { catId: '$categoryId', userId: '$userId' },
            pipeline: [
              {
                $match: {
                  $expr: { $and: [{ $eq: ['$categoryId', '$$catId'] }, { $eq: ['$userId', '$$userId'] }] },
                },
              },
              { $project: { categoryName: 1, _id: 0 } },
            ],
            as: 'categoryDetails',
          },
        },
        { $addFields: { categoryName: { $arrayElemAt: ['$categoryDetails.categoryName', 0] } } },
        { $project: { categoryDetails: 0 } },
        { $sort: { createdAt: -1 } },
      ]);

      return res.status(200).json({ status: 200, success: true, message: expenses.length > 0 ? MESSAGE.SUCCESS.EXPENSE_FETCHED : 'No expenses found', data: expenses });
    } catch (error) {
      console.error('Error fetching expenses:', error);
      return res.status(500).json({ status: 500, success: false, message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` });
    }
  }

  async createExpense(createExpenseDto: CreateExpenseDto, res: Response): Promise<Response> {
    try {
      const now = Date.now();
      const newExpense = new this.expenseModel({
        ...createExpenseDto,
        createdAt: createExpenseDto.createdAt ? Number(createExpenseDto.createdAt) : now,
        updatedAt: createExpenseDto.updatedAt ? Number(createExpenseDto.updatedAt) : now,
      });
      const savedExpense = await newExpense.save();
      const data = await this.enrichWithCategory(savedExpense);

      return res.status(200).json({ status: 200, success: true, message: MESSAGE.SUCCESS.EXPENSE_ADDED, data });
    } catch (error) {
      console.error('Error creating expense:', error);
      return res.status(500).json({ status: 500, success: false, message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` });
    }
  }

  async updateExpense(id: string, updateDto: Partial<CreateExpenseDto>, res: Response): Promise<Response> {
    try {
      const existingExpense = await this.expenseModel.findById(id);
      if (!existingExpense)
        return res.status(404).json({ success: false, message: MESSAGE.ERROR.EXPENSE_NOT_FOUND });

      const updated = await this.expenseModel.findByIdAndUpdate(
        id,
        {
          ...updateDto,
          createdAt: updateDto.createdAt ? Number(updateDto.createdAt) : existingExpense.createdAt,
          updatedAt: Date.now(),
        },
        { new: true },
      );

      const finalData = await this.enrichWithCategory(updated);
      return res.status(200).json({ status: 200, success: true, message: MESSAGE.SUCCESS.EXPENSE_UPDATED, data: finalData });
    } catch (error) {
      console.error('Error updating expense:', error);
      return res.status(500).json({ status: 500, success: false, message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` });
    }
  }

  async deleteExpense(id: string, res: Response): Promise<Response> {
    try {
      const expense = await this.expenseModel.findById(id);
      if (!expense)
        return res.status(404).json({ status: 404, success: false, message: MESSAGE.ERROR.EXPENSE_NOT_FOUND });

      await this.expenseModel.findByIdAndDelete(id);

      return res.status(200).json({ status: 200, success: true, message: MESSAGE.SUCCESS.EXPENSE_DELETED });
    } catch (error) {
      console.error('Error deleting expense:', error);
      return res.status(500).json({ status: 500, success: false, message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` });
    }
  }

  async getCurrentMonthExpenseGoalsByCategory(userId: number, categoryId: number, createdAt: number, res: Response): Promise<Response> {
    try {
      if (!userId || !categoryId || !createdAt)
        return res.status(400).json({ status: 400, success: false, message: MESSAGE.ERROR.USER_CATEGORY_CREATED_AT_MISSING });

      const { startOfMonth, endOfMonth } = this.getMonthRange(createdAt);
      const goal = await this.expenseGoalModel.findOne({
        userId,
        categoryId,
        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
      });

      if (!goal) return res.status(404).json({ status: 404, success: false, message: MESSAGE.ERROR.NO_EXPENSE_GOAL_FOUND });

      return res.status(200).json({ status: 200, success: true, data: goal });
    } catch (error) {
      console.error('Error fetching expense goal:', error);
      return res.status(500).json({ status: 500, success: false, message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` });
    }
  }

  async getCurrentMonthCategoryList(userId: number, search: string, createdAt: number, res: Response): Promise<Response> {
    try {
      if (!createdAt) return res.status(400).json({ status: 400, success: false, message: MESSAGE.ERROR.CREATEDAT_MISSING });

      const { startOfMonth, endOfMonth } = this.getMonthRange(createdAt);
      const searchRegex = search?.trim() ? new RegExp(search.trim(), 'i') : null;

      const categoriesAgg: any[] = [
        { $match: { userId, createdAt: { $gte: startOfMonth, $lte: endOfMonth } } },
        { $group: { _id: '$categoryId' } },
        {
          $lookup: {
            from: 'categories',
            localField: '_id',
            foreignField: 'categoryId',
            as: 'categoryData',
          },
        },
        { $unwind: '$categoryData' },
        {
          $project: {
            _id: 0,
            categoryId: '$categoryData.categoryId',
            categoryName: '$categoryData.categoryName',
          },
        },
      ];
      if (searchRegex) categoriesAgg.push({ $match: { categoryName: searchRegex } });
      categoriesAgg.push({ $sort: { categoryName: 1 } });

      const finalList = await this.expenseGoalModel.aggregate(categoriesAgg).exec();
      return res.status(200).json({ status: 200, success: true, message: MESSAGE.SUCCESS.CATEGORY_FETCHED, data: finalList });
    } catch (error) {
      console.error('Error fetching categories:', error);
      return res.status(500).json({ status: 500, success: false, message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` });
    }
  }

  async getAllUniqueCategoryList(userId: number, res: Response): Promise<Response> {
    try {
      if (!userId) return res.status(400).json({ status: 400, success: false, message: MESSAGE.ERROR.INVALID_USER_ID });

      const categories = await this.expenseModel.aggregate([
        { $match: { userId } },
        { $group: { _id: '$categoryId' } },
        {
          $lookup: {
            from: 'categories',
            let: { categoryId: '$_id', userId },
            pipeline: [
              {
                $match: {
                  $expr: { $and: [{ $eq: ['$categoryId', '$$categoryId'] }, { $eq: ['$userId', '$$userId'] }] },
                },
              },
              { $project: { _id: 0, categoryName: 1 } },
            ],
            as: 'categoryDetails',
          },
        },
        {
          $addFields: {
            categoryId: '$_id',
            categoryName: { $arrayElemAt: ['$categoryDetails.categoryName', 0] },
          },
        },
        { $project: { _id: 0, categoryDetails: 0 } },
        { $sort: { categoryName: 1 } },
      ]);

      return res.status(200).json({ status: 200, success: true, message: MESSAGE.SUCCESS.CATEGORY_FETCHED, data: categories });
    } catch (error) {
      console.error('Error fetching unique categories:', error);
      return res.status(500).json({ status: 500, success: false, message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` });
    }
  }
}