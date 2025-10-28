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

    private getMonthRange(timestamp?: number): { startOfMonth: number; endOfMonth: number } {
        const date = timestamp ? new Date(timestamp) : new Date();
        const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
        const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
        return { startOfMonth, endOfMonth };
    }

    private async getMonthlyTotalExpense(userId: number, categoryId: number, monthTimestamp?: number): Promise<number> {
        const { startOfMonth, endOfMonth } = this.getMonthRange(monthTimestamp);
        const [{ totalAmount = 0 } = {}] = await this.expenseModel.aggregate([
            { $match: { userId, categoryId, createdAt: { $gte: startOfMonth, $lte: endOfMonth } } },
            { $group: { _id: null, totalAmount: { $sum: "$amount" } } }
        ]);
        return totalAmount;
    }

    private async populateCategory(expenseGoals: ExpenseGoalDocument[] | ExpenseGoalDocument) {
        const goals = Array.isArray(expenseGoals) ? expenseGoals : [expenseGoals];
        const populated = await this.expenseGoalModel.aggregate([
            { $match: { _id: { $in: goals.map(g => g._id) } } },
            {
                $lookup: {
                    from: "categories",
                    let: { uid: "$userId", cid: "$categoryId" },
                    pipeline: [
                        { $match: { $expr: { $and: [{ $eq: ["$userId", "$$uid"] }, { $eq: ["$categoryId", "$$cid"] }] } } },
                        { $project: { _id: 0, categoryName: 1 } }
                    ],
                    as: "categoryData"
                }
            },
            { $addFields: { categoryName: { $ifNull: [{ $arrayElemAt: ["$categoryData.categoryName", 0] }, null] } } },
            { $project: { categoryData: 0 } },
        ]);
        return populated;
    }

    async getUserExpensesGoal(res: Response, userId: number, from?: number, to?: number): Promise<Response> {
        try {
            const match: any = { userId: Number(userId) };
            if (from && to) match.createdAt = { $gte: from, $lte: to };
            else if (from) match.createdAt = { $gte: from };
            else if (to) match.createdAt = { $lte: to };

            const expenseGoals = await this.expenseGoalModel.aggregate([
                { $match: match },
                {
                    $lookup: {
                        from: "categories",
                        let: { uid: "$userId", cid: "$categoryId" },
                        pipeline: [
                            { $match: { $expr: { $and: [{ $eq: ["$userId", "$$uid"] }, { $eq: ["$categoryId", "$$cid"] }] } } },
                            { $project: { _id: 0, categoryName: 1 } }
                        ],
                        as: "categoryData"
                    }
                },
                { $addFields: { categoryName: { $ifNull: [{ $arrayElemAt: ["$categoryData.categoryName", 0] }, null] } } },
                { $project: { categoryData: 0 } },
                { $sort: { createdAt: -1 } }
            ]);

            const withCurrentAmounts = await Promise.all(
                expenseGoals.map(async (goal) => ({
                    ...goal,
                    currentAmount: await this.getMonthlyTotalExpense(goal.userId, goal.categoryId, goal.createdAt)
                }))
            );

            return res.status(200).json({ status: 200, success: true, message: MESSAGE.SUCCESS.EXPENSE_GOAL_FETCHED, data: withCurrentAmounts });
        } catch (error) {
            console.error("Error fetching expense goals:", error);
            return res.status(500).json({ status: 500, success: false, message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` });
        }
    }

    async createExpenseGoal(createExpenseGoalDto: CreateExpenseGoalDto, res: Response): Promise<Response> {
        try {
            const { userId, categoryId } = createExpenseGoalDto;
            if (userId === undefined || categoryId === undefined) {
                return res.status(400).json({ status: 400, success: false, message: MESSAGE.ERROR.USERID_CATEGORYID_MISSING });
            }

            const existingGoal = await this.expenseGoalModel.findOne({
                userId,
                categoryId,
                ...this.getMonthRange(Date.now())
            });

            if (existingGoal) {
                return res.status(400).json({ status: 400, success: false, message: MESSAGE.ERROR.CATEGORY_EXITS_IN_CURRENT_MONTH });
            }

            const now = Date.now();
            const newExpenseGoal = new this.expenseGoalModel({
                ...createExpenseGoalDto,
                createdAt: now,
                updatedAt: now,
            });

            const savedGoal = await newExpenseGoal.save();
            const [goalWithCategory] = await this.populateCategory(savedGoal);

            const currentAmount = await this.getMonthlyTotalExpense(savedGoal.userId, savedGoal.categoryId, savedGoal.createdAt);

            return res.status(200).json({ status: 200, success: true, message: MESSAGE.SUCCESS.EXPENSE_ADDED, data: { ...goalWithCategory, currentAmount } });
        } catch (error) {
            console.error("Error creating expense goal:", error);
            return res.status(500).json({ status: 500, success: false, message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` });
        }
    }

    async updateExpenseGoal(id: string, updateDto: Partial<CreateExpenseGoalDto>, res: Response): Promise<Response> {
        try {
            const updated = await this.expenseGoalModel.findByIdAndUpdate(
                id,
                { ...updateDto, updatedAt: Date.now() },
                { new: true }
            );

            if (!updated) return res.status(404).json({ status: 404, success: false, message: MESSAGE.ERROR.EXPENSE_NOT_FOUND });

            const [withCategory] = await this.populateCategory(updated);
            const currentAmount = await this.getMonthlyTotalExpense(updated.userId, updated.categoryId, updated.createdAt);

            return res.status(200).json({ status: 200, success: true, message: MESSAGE.SUCCESS.EXPENSE_UPDATED, data: { ...withCategory, currentAmount } });
        } catch (error) {
            console.error('Error updating expense goal:', error);
            return res.status(500).json({ status: 500, success: false, message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` });
        }
    }

    async deleteExpenseGoal(id: string, res: Response): Promise<Response> {
        try {
            const result = await this.expenseGoalModel.findByIdAndDelete(id);
            if (!result) {
                return res.status(404).json({ status: 404, success: false, message: MESSAGE.ERROR.EXPENSE_NOT_FOUND });
            }
            return res.status(200).json({ status: 200, success: true, message: MESSAGE.SUCCESS.EXPENSE_DELETED });
        } catch (error) {
            console.error('Error deleting expense goal:', error);
            return res.status(500).json({ status: 500, success: false, message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` });
        }
    }
}

