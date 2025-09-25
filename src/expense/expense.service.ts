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

  async getUserExpenses(res: Response, payload: { userId: number; from?: number; to?: number; categoryId?: number }): Promise<Response> {
    try {
      const { userId, from, to, categoryId } = payload;

      const match: any = { userId: Number(userId) };

      if (from && to) {
        match.createdAt = { $gte: Number(from), $lte: Number(to) };
      } else if (from) {
        match.createdAt = { $gte: Number(from) };
      } else if (to) {
        match.createdAt = { $lte: Number(to) };
      }

      if (categoryId) {
        match.categoryId = Number(categoryId);
      }

      const expenses = await this.expenseModel.aggregate([
        { $match: match },
        {
          $lookup: {
            from: 'categories',
            let: { catId: '$categoryId', userId: '$userId' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$categoryId', { $toInt: '$$catId' }] },
                      { $eq: ['$userId', { $toInt: '$$userId' }] }
                    ]
                  }
                }
              },
              { $project: { categoryName: 1, _id: 0 } }
            ],
            as: 'categoryDetails'
          }
        },
        {
          $addFields: {
            categoryName: { $arrayElemAt: ['$categoryDetails.categoryName', 0] }
          }
        },
        { $project: { categoryDetails: 0 } },
        { $sort: { createdAt: -1 } }
      ]);

      return res.status(200).json({ status: 200, success: true, message: expenses.length > 0 ? MESSAGE.SUCCESS.EXPENSE_FETCHED : 'No expenses found', data: expenses });
    } catch (error) {
      console.error('Error fetching expenses:', error);
      return res.status(500).json({ status: 500, success: false, message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` });
    }
  }

  async createExpense(createExpenseDto: CreateExpenseDto, res: Response): Promise<Response> {
    try {
      const now = new Date();

      const newExpense = new this.expenseModel({
        ...createExpenseDto,
        createdAt: now.getTime(),
        updatedAt: now.getTime(),
      });
      const savedExpense = await newExpense.save();

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();

      const [{ totalAmount = 0 } = {}] = await this.expenseModel.aggregate([
        {
          $match: {
            userId: createExpenseDto.userId,
            categoryId: createExpenseDto.categoryId,
            createdAt: { $gte: startOfMonth, $lte: endOfMonth },
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amount" },
          },
        },
      ]);

      await this.expenseGoalModel.findOneAndUpdate(
        {
          userId: createExpenseDto.userId,
          categoryId: createExpenseDto.categoryId,
          createdAt: { $gte: startOfMonth, $lte: endOfMonth },
        },
        {
          $set: { currentAmount: totalAmount, updatedAt: now },
        },
        { new: true }
      );

      const [data] = await this.expenseModel.aggregate([
        { $match: { _id: savedExpense._id } },
        {
          $lookup: {
            from: "categories",
            let: { userId: "$userId", categoryId: "$categoryId" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$userId", "$$userId"] },
                      { $eq: ["$categoryId", "$$categoryId"] },
                    ],
                  },
                },
              },
              { $project: { _id: 0, categoryName: 1 } },
            ],
            as: "categoryDetails",
          },
        },
        {
          $addFields: {
            categoryName: { $arrayElemAt: ["$categoryDetails.categoryName", 0] },
          },
        },
        { $project: { categoryDetails: 0 } },
      ]);

      return res.status(200).json({ status: 200, success: true, message: MESSAGE.SUCCESS.EXPENSE_ADDED, data });
    } catch (error) {
      console.error("Error creating expense:", error);
      return res.status(500).json({ status: 500, success: false, message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` });
    }
  }

  async updateExpense(id: string, updateDto: Partial<CreateExpenseDto>, res: Response): Promise<Response> {
    try {
      const existingExpense = await this.expenseModel.findById(id);
      if (!existingExpense) {
        return res.status(404).json({ success: false, message: MESSAGE.ERROR.EXPANSE_NOT_FOUND });
      }

      const updated = await this.expenseModel.findByIdAndUpdate(
        id,
        { ...updateDto, updatedAt: Date.now() },
        { new: true }
      );

      if (updated?.categoryId) {
        const expenseDate = new Date(Number(updated.createdAt));
        const startOfMonth = new Date(expenseDate.getFullYear(), expenseDate.getMonth(), 1).getTime();
        const endOfMonth = new Date(expenseDate.getFullYear(), expenseDate.getMonth() + 1, 0, 23, 59, 59, 999).getTime();

        const totalAmountAgg = await this.expenseModel.aggregate([
          {
            $match: {
              userId: updated.userId,
              categoryId: updated.categoryId,
              createdAt: { $gte: startOfMonth, $lte: endOfMonth }
            }
          },
          {
            $group: {
              _id: null,
              totalAmount: { $sum: '$amount' }
            }
          }
        ]);

        const totalAmount = totalAmountAgg.length > 0 ? totalAmountAgg[0].totalAmount : 0;

        await this.expenseGoalModel.findOneAndUpdate(
          {
            categoryId: updated.categoryId,
            userId: updated.userId,
            createdAt: { $gte: startOfMonth, $lte: endOfMonth }
          },
          {
            $set: { currentAmount: totalAmount, updatedAt: new Date() }
          },
          { new: true }
        );
      }

      const [finalData] = await this.expenseModel.aggregate([
        { $match: { _id: updated?._id } },
        {
          $lookup: {
            from: 'categories',
            let: { userId: '$userId', categoryId: '$categoryId' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$userId', '$$userId'] },
                      { $eq: ['$categoryId', '$$categoryId'] }
                    ]
                  }
                }
              },
              { $project: { _id: 0, categoryName: 1 } }
            ],
            as: 'categoryDetails'
          }
        },
        {
          $addFields: {
            categoryName: { $arrayElemAt: ['$categoryDetails.categoryName', 0] }
          }
        },
        { $project: { categoryDetails: 0 } }
      ]);

      return res.status(200).json({ status: 200, success: true, message: MESSAGE.SUCCESS.EXPENSE_UPDATED, data: finalData });
    } catch (error) {
      console.error('Error updating expense:', error);
      return res.status(500).json({ status: 500, success: false, message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` });
    }
  }

  async deleteExpense(id: string, res: Response): Promise<Response> {
    try {
      const expense = await this.expenseModel.findById(id);
      if (!expense) {
        return res.status(404).json({ status: 404, success: false, message: MESSAGE.ERROR.EXPANSE_NOT_FOUND });
      }

      const { userId, categoryId, createdAt } = expense;

      const expenseDate = new Date(Number(createdAt));
      const startOfMonth = new Date(expenseDate.getFullYear(), expenseDate.getMonth(), 1).getTime();
      const endOfMonth = new Date(expenseDate.getFullYear(), expenseDate.getMonth() + 1, 0, 23, 59, 59, 999).getTime();

      await this.expenseModel.findByIdAndDelete(id);

      const totalAmountAgg = await this.expenseModel.aggregate([
        {
          $match: {
            userId,
            categoryId,
            createdAt: { $gte: startOfMonth, $lte: endOfMonth }
          }
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' }
          }
        }
      ]);

      const totalAmount = totalAmountAgg.length > 0 ? totalAmountAgg[0].totalAmount : 0;

      await this.expenseGoalModel.findOneAndUpdate(
        {
          userId,
          categoryId,
          createdAt: { $gte: startOfMonth, $lte: endOfMonth }
        },
        {
          $set: { currentAmount: totalAmount, updatedAt: new Date() }
        },
        { new: true }
      );

      return res.status(200).json({ status: 200, success: true, message: MESSAGE.SUCCESS.EXPENSE_DELETED });
    } catch (error) {
      console.error('Error deleting expense:', error);
      return res.status(500).json({ status: 500, success: false, message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` });
    }
  }

  async getCurrentMonthExpenseGoalsByCategory(userId: number, categoryId: number, createdAt: number, res: Response): Promise<Response> {
    try {
      if (!userId) {
        return res.status(400).json({ status: 400, success: false, message: "User ID is required" });
      }

      if (!categoryId) {
        return res.status(400).json({ status: 400, success: false, message: "Category is required" });
      }

      if (!createdAt) {
        return res.status(400).json({ status: 400, success: false, message: "CreatedAt timestamp is required" });
      }

      const targetDate = new Date(Number(createdAt));
      const startOfMonth = (new Date(targetDate.getFullYear(), targetDate.getMonth(), 1)).getTime();
      const endOfMonth = (new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999)).getTime();

      const goal = await this.expenseGoalModel.findOne({ userId: Number(userId), categoryId: categoryId, createdAt: { $gte: startOfMonth, $lte: endOfMonth } });

      if (!goal) {
        return res.status(404).json({ status: 404, success: false, message: "No expense goal found for this user, category, and month" });
      }

      return res.status(200).json({ status: 200, success: true, data: goal });

    } catch (error) {
      console.error('Error fetching expense goal:', error);
      return res.status(500).json({ status: 500, success: false, message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` });
    }
  }

  async getCurrentMonthCategoryList(userId: string, search: string, createdAt: number, res: Response): Promise<Response> {
    try {
      const userIdNum = Number(userId);

      if (!createdAt) {
        return res.status(400).json({ status: 400, success: false, message: "CreatedAt timestamp is required" });
      }

      const targetDate = new Date(Number(createdAt));
      const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1).getTime();
      const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999).getTime();

      const searchRegex = search?.trim() ? new RegExp(search.trim(), "i") : null;

      const categoriesAgg: any[] = [
        {
          $match: {
            userId: userIdNum,
            createdAt: { $gte: startOfMonth, $lte: endOfMonth },
          },
        },
        {
          $group: { _id: "$categoryId" },
        },
        {
          $lookup: {
            from: "categories",
            localField: "_id",
            foreignField: "categoryId",
            as: "categoryData",
          },
        },
        { $unwind: "$categoryData" },
        {
          $project: {
            _id: 0,
            categoryId: "$categoryData.categoryId",
            categoryName: "$categoryData.categoryName",
          },
        },
      ];

      if (searchRegex) {
        categoriesAgg.push({ $match: { categoryName: searchRegex } });
      }

      categoriesAgg.push({ $sort: { categoryName: 1 } });

      const finalList = await this.expenseGoalModel.aggregate(categoriesAgg).exec();

      return res.status(200).json({ status: 200, success: true, message: MESSAGE.SUCCESS.CATEGORY_FETCHED, data: finalList });
    } catch (error) {
      console.error("Error fetching categories:", error);
      return res.status(500).json({ status: 500, success: false, message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` });
    }
  }

  async getAllUniqueCategoryList(userId: string, res: Response): Promise<Response> {
    try {
      const userIdNum = Number(userId);
      if (!userIdNum) {
        return res.status(400).json({ status: 400, success: false, message: "Invalid User ID" });
      }

      const categories = await this.expenseModel.aggregate([
        { $match: { userId: userIdNum } },
        { $group: { _id: "$categoryId" } },
        {
          $lookup: {
            from: "categories",
            let: { categoryId: "$_id", userId: userIdNum },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$categoryId", "$$categoryId"] },
                      { $eq: ["$userId", "$$userId"] }
                    ]
                  }
                }
              },
              { $project: { _id: 0, categoryName: 1 } }
            ],
            as: "categoryDetails"
          }
        },
        {
          $addFields: {
            categoryId: "$_id",
            categoryName: { $arrayElemAt: ["$categoryDetails.categoryName", 0] }
          }
        },
        { $project: { _id: 0, categoryDetails: 0 } },
        { $sort: { categoryName: 1 } }
      ]);

      return res.status(200).json({ status: 200, success: true, message: MESSAGE.SUCCESS.CATEGORY_FETCHED, data: categories });
    } catch (error) {
      console.error("Error fetching unique categories:", error);
      return res.status(500).json({ status: 500, success: false, message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` });
    }
  }
}
