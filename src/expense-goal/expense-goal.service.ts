import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { CreateExpenseGoalDto } from 'config/interfaces';
import { Model } from 'mongoose';
import { ExpenseGoal, ExpenseGoalDocument } from './expense-goal.schema';
import { Response } from 'express';
import { MESSAGE } from 'config/message';

@Injectable()
export class ExpenseGoalService {
    constructor(
        @InjectModel(ExpenseGoal.name) private expenseGoalModel: Model<ExpenseGoalDocument>,
    ) { }

    async createExpenseGoal(createExpenseGoalDto: CreateExpenseGoalDto, res: Response): Promise<Response> {
        try {

            const { userId, category } = createExpenseGoalDto;
            const existingGoal = await this.expenseGoalModel.findOne({ userId, category: category.trim() });
            if (existingGoal) {
                return res.status(200).json({ status: 400, success: false, message: `Category "${category}" already exists for this user.` });
            }

            const now = Date.now();
            const newExpenseGoal = new this.expenseGoalModel({
                ...createExpenseGoalDto,
                createdAt: now,
                updatedAt: now,
            });
            const data = await newExpenseGoal.save();
            return res.status(200).json({ status: 200, success: true, message: MESSAGE.SUCCESS.EXPENSE_ADDED, data });
        } catch (error) {
            console.error('Error creating expense goal:', error);
            return res.status(500).json({ message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` })
        }
    }

    async getAllExpenseGoalByUserId(res: Response, userId: number, from?: number, to?: number): Promise<Response> {
        try {
            const query: any = { userId };

            if (from && to) {
                query.createdAt = { $gte: from, $lte: to };
            } else if (from) {
                query.createdAt = { $gte: from };
            } else if (to) {
                query.createdAt = { $lte: to };
            }

            const expenseGoal = await this.expenseGoalModel.find(query).sort({ createdAt: -1 });

            return res.status(200).json({
                status: 200,
                success: true,
                message: MESSAGE.SUCCESS.EXPENSE_FETCHED,
                data: expenseGoal
            });
        } catch (error) {
            console.error('Error fetching expense goal:', error);
            return res.status(500).json({ message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` });
        }
    }

    async updateExpenseGoal(id: string, updateDto: Partial<CreateExpenseGoalDto>, res: Response): Promise<Response> {
        try {

            if (updateDto.category) {
                const { userId, category } = updateDto;
                const existingGoal = await this.expenseGoalModel.findOne({ userId, category: category.trim() });
                if (existingGoal) {
                    return res.status(200).json({ status: 400, success: false, message: `Category "${category}" already exists for this user.` });
                }
            }

            const updated = await this.expenseGoalModel.findByIdAndUpdate(id, { ...updateDto, updatedAt: Date.now() }, { new: true });
            if (!updated) {
                return res.status(404).json({ success: false, message: MESSAGE.ERROR.EXPANSE_NOT_FOUND });
            }
            return res.status(200).json({ status: 200, success: true, message: MESSAGE.SUCCESS.EXPENSE_UPDATED, data: updated });
        } catch (error) {
            console.error('Error updating expense goal:', error);
            return res.status(500).json({ message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` })
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
            return res.status(500).json({ message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` })
        }
    }
}
