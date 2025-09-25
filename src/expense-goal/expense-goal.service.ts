import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { CreateExpenseGoalDto } from 'config/interfaces';
import { Model } from 'mongoose';
import { ExpenseGoal, ExpenseGoalDocument } from './expense-goal.schema';
import { Response } from 'express';
import { MESSAGE } from 'config/message';
import { Expense, ExpenseDocument } from 'src/expense/expense.schema';

@Injectable()
export class ExpenseGoalService {
    constructor(
        @InjectModel(ExpenseGoal.name) private expenseGoalModel: Model<ExpenseGoalDocument>,
        @InjectModel(Expense.name) private expenseModel: Model<ExpenseDocument>,
    ) { }

    async getUserExpensesGoal(res: Response, userId: number, from?: number, to?: number): Promise<Response> {

        try {
            const match: any = { userId: Number(userId) };

            if (from && to) {
                match.createdAt = { $gte: from, $lte: to };
            } else if (from) {
                match.createdAt = { $gte: from };
            } else if (to) {
                match.createdAt = { $lte: to };
            }

            const expenseGoals = await this.expenseGoalModel.aggregate([
                { $match: match },
                {
                    $lookup: {
                        from: "categories",
                        let: { uid: "$userId", cid: "$categoryId" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$userId", "$$uid"] },
                                            { $eq: ["$categoryId", "$$cid"] }
                                        ]
                                    }
                                }
                            },
                            { $project: { _id: 0, categoryName: 1 } }
                        ],
                        as: "categoryData"
                    }
                },
                {
                    $addFields: {
                        categoryName: {
                            $ifNull: [{ $arrayElemAt: ["$categoryData.categoryName", 0] }, null]
                        }
                    }
                },
                { $project: { categoryData: 0 } },
                { $sort: { createdAt: -1 } }
            ]);

            return res.status(200).json({ status: 200, success: true, message: "Expense goals fetched successfully", data: expenseGoals });
        } catch (error) {
            console.error("Error fetching expense goals:", error);
            return res.status(500).json({ status: 500, success: false, message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` });
        }
    }

    async createExpenseGoal(createExpenseGoalDto: CreateExpenseGoalDto, res: Response): Promise<Response> {
        try {
            const { userId, categoryId } = createExpenseGoalDto;

            const now = Date.now();
            const expenseDate = new Date(now);
            const startOfMonth = new Date(expenseDate.getFullYear(), expenseDate.getMonth(), 1).getTime();
            const endOfMonth = new Date(expenseDate.getFullYear(), expenseDate.getMonth() + 1, 0, 23, 59, 59, 999).getTime();

            const existingGoal = await this.expenseGoalModel.findOne({
                userId,
                categoryId,
                createdAt: { $gte: startOfMonth, $lte: endOfMonth },
            });

            if (existingGoal) {
                return res.status(400).json({ status: 400, success: false, message: `Category already exists for this month.` });
            }

            const [{ totalAmount = 0 } = {}] = await this.expenseModel.aggregate([
                {
                    $match: {
                        userId,
                        categoryId,
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

            const newExpenseGoal = new this.expenseGoalModel({
                ...createExpenseGoalDto,
                currentAmount: totalAmount,
                createdAt: now,
                updatedAt: now,
            });

            const savedGoal = await newExpenseGoal.save();

            const [goalWithCategory] = await this.expenseGoalModel.aggregate([
                { $match: { _id: savedGoal._id } },
                {
                    $lookup: {
                        from: "categories",
                        let: { uid: "$userId", cid: "$categoryId" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$userId", "$$uid"] },
                                            { $eq: ["$categoryId", "$$cid"] },
                                        ],
                                    },
                                },
                            },
                            { $project: { _id: 0, categoryName: 1 } },
                        ],
                        as: "categoryData",
                    },
                },
                {
                    $addFields: {
                        categoryName: {
                            $ifNull: [{ $arrayElemAt: ["$categoryData.categoryName", 0] }, null],
                        },
                    },
                },
                { $project: { categoryData: 0 } },
            ]);

            return res.status(200).json({ status: 200, success: true, message: MESSAGE.SUCCESS.EXPENSE_ADDED, data: goalWithCategory });
        } catch (error) {
            console.error("Error creating expense goal:", error);
            return res.status(500).json({ status: 500, success: false, message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` });
        }
    }

    async updateExpenseGoal(id: string, updateDto: Partial<CreateExpenseGoalDto>, res: Response): Promise<Response> {
        try {
            if (updateDto.categoryId && updateDto.userId && updateDto.createdAt) {
                const { userId, categoryId, createdAt, _id } = updateDto;

                const expenseDate = new Date(Number(updateDto.createdAt));
                const startOfMonth = new Date(expenseDate.getFullYear(), expenseDate.getMonth(), 1).getTime();
                const endOfMonth = new Date(expenseDate.getFullYear(), expenseDate.getMonth() + 1, 0, 23, 59, 59, 999).getTime();

                const existingGoal = await this.expenseGoalModel.findOne({
                    userId,
                    categoryId,
                    createdAt: { $gte: startOfMonth, $lte: endOfMonth },
                    _id: { $ne: _id }
                });

                if (existingGoal) {
                    return res.status(200).json({ status: 400, success: false, message: `Category already exists for this month.` });
                }
            }

            const updated = await this.expenseGoalModel.findByIdAndUpdate(
                id,
                { ...updateDto, updatedAt: Date.now() },
                { new: true }
            );

            if (!updated) {
                return res.status(404).json({ success: false, message: MESSAGE.ERROR.EXPANSE_NOT_FOUND });
            }

            const [withCategory] = await this.expenseGoalModel.aggregate([
                { $match: { _id: updated._id } },
                {
                    $lookup: {
                        from: "categories",
                        let: { uid: "$userId", cid: "$categoryId" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$userId", "$$uid"] },
                                            { $eq: ["$categoryId", "$$cid"] }
                                        ]
                                    }
                                }
                            },
                            { $project: { _id: 0, categoryName: 1 } }
                        ],
                        as: "categoryData"
                    }
                },
                {
                    $addFields: {
                        categoryName: {
                            $ifNull: [{ $arrayElemAt: ["$categoryData.categoryName", 0] }, null]
                        }
                    }
                },
                { $project: { categoryData: 0 } }
            ]);

            return res.status(200).json({ status: 200, success: true, message: MESSAGE.SUCCESS.EXPENSE_UPDATED, data: withCategory });
        } catch (error) {
            console.error('Error updating expense goal:', error);
            return res.status(500).json({ status: 500, success: false, message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` });
        }
    }

    async deleteExpenseGoal(id: string, res: Response): Promise<Response> {
        try {
            const result = await this.expenseGoalModel.findByIdAndDelete(id);
            if (!result) {
                return res.status(404).json({ status: 404, success: false, message: MESSAGE.ERROR.EXPANSE_NOT_FOUND });
            }
            return res.status(200).json({ status: 200, success: true, message: MESSAGE.SUCCESS.EXPENSE_DELETED, });
        } catch (error) {
            console.error('Error deleting expense goal:', error);
            return res.status(500).json({ status: 500, success: false, message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` });
        }
    }
}
