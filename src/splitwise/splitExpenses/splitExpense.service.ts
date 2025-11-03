import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Response } from 'express';
import { SplitExpense, SplitExpenseDocument } from './splitExpense.schema';
import { Category, CategoryDocument } from 'src/category/category.schema';
import { ExpenseGoal, ExpenseGoalDocument } from 'src/expense-goal/expense-goal.schema';
import { Expense, ExpenseDocument } from 'src/expense/expense.schema';
import { SPLITWISE_DEFAULTS } from 'config/constant';
import { MESSAGE } from 'config/message';
import { SplitGroup, SplitGroupDocument } from '../splitGroups/splitGroups.schema';
import { CreateExpenseDto, SettleDataDto, SplitExpenseDto } from 'config/interfaces';
import { User, UserDocument } from 'src/user/user.schema';

@Injectable()
export class SplitExpenseService {
    constructor(
        @InjectModel(SplitGroup.name) private readonly splitGroupsModel: Model<SplitGroupDocument>,
        @InjectModel(SplitExpense.name) private readonly splitExpenseModel: Model<SplitExpenseDocument>,
        @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
        @InjectModel(ExpenseGoal.name) private readonly expenseGoalModel: Model<ExpenseGoalDocument>,
        @InjectModel(Expense.name) private readonly expensesModel: Model<ExpenseDocument>,
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    ) { }

    async getExpensesByGroup(splitGroupId: number, res: Response): Promise<Response> {
        try {
            splitGroupId = Number(splitGroupId);
            const expenses = await this.splitExpenseModel.aggregate([
                { $match: { splitGroupId } },
                { $sort: { createdAt: -1 } },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'paidBy',
                        foreignField: 'id',
                        as: 'paidByObj'
                    }
                },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'splitBetween',
                        foreignField: 'id',
                        as: 'splitBetweenObjs'
                    }
                },
                {
                    $addFields: {
                        paidBy: {
                            $cond: [
                                { $gt: [{ $size: "$paidByObj" }, 0] },
                                { userId: { $arrayElemAt: ["$paidByObj.id", 0] }, name: { $arrayElemAt: ["$paidByObj.name", 0] } },
                                { userId: null, name: "Unknown" }
                            ]
                        },
                        splitBetween: {
                            $map: {
                                input: "$splitBetweenObjs",
                                as: "u",
                                in: { userId: "$$u.id", name: "$$u.name" }
                            }
                        }
                    }
                },
                {
                    $project: {
                        paidByObj: 0,
                        splitBetweenObjs: 0,
                        __v: 0
                    }
                }
            ]);
            return res.status(200).json({ status: 200, success: true, message: MESSAGE.SUCCESS.SPLIT_EXPENSE_FETCHED, data: expenses });
        } catch (error) {
            console.error('Error fetching expenses:', error);
            return res.status(500).json({ status: 500, success: false, message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` });
        }
    }

    async createSplitExpense(expenseDto: SplitExpenseDto, res: Response): Promise<Response> {
        try {
            const { paidBy, amount, title, splitGroupId } = expenseDto;
            const now = Date.now();

            const splitGroup = await this.splitGroupsModel.findOne({ splitGroupId }).exec();
            if (!splitGroup) {
                return res.status(404).json({ status: 404, success: false, message: `Split group with ID ${splitGroupId} not found` });
            }

            const groupName = splitGroup.name;

            const lastExpense = await this.splitExpenseModel.findOne().sort({ splitExpenseId: -1 }).exec();
            const newId = lastExpense ? lastExpense.splitExpenseId + 1 : Date.now();

            const newExpense = new this.splitExpenseModel({
                ...expenseDto,
                title,
                splitExpenseId: newId,
                createdAt: now,
                updatedAt: now,
            });
            await newExpense.save();

            const splitCategory = await this.categoryModel.findOne({
                categoryName: SPLITWISE_DEFAULTS.CATEGORIES.SPLIT_EXPENSE.categoryName,
                userId: paidBy
            }).exec();

            if (splitCategory) {
                await this.expensesModel.create({
                    userId: paidBy,
                    categoryId: splitCategory.categoryId,
                    name: SPLITWISE_DEFAULTS.CATEGORIES.SPLIT_EXPENSE.expenseName(groupName),
                    expenseType: "Expense",
                    amount,
                    description: SPLITWISE_DEFAULTS.CATEGORIES.SPLIT_EXPENSE.expenseDescription(title, groupName),
                    createdAt: now,
                    updatedAt: now
                });
            }

            return res.status(200).json({ status: 200, success: true, message: MESSAGE.SUCCESS.SPLIT_EXPENSE_CREATED, data: newExpense });

        } catch (error) {
            console.error('Error creating split expense:', error);
            return res.status(500).json({ status: 500, success: false, message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` });
        }
    }

    async updateSplitExpense(splitExpenseId: number, expenseDto: SplitExpenseDto, res: Response): Promise<Response> {
        try {
            const now = Date.now();
            const { _id, __v, createdAt, updatedAt, ...updateData } = expenseDto;

            const updated = await this.splitExpenseModel.updateOne(
                { splitExpenseId },
                { ...updateData, updatedAt: now }
            ).exec();

            if (updated.modifiedCount === 0) {
                return res.status(404).json({ status: 404, success: false, message: MESSAGE.ERROR.EXPENSE_NOT_FOUND });
            }

            const splitGroup = await this.splitGroupsModel.findOne({ splitGroupId: expenseDto.splitGroupId }).exec();
            const groupName = splitGroup ? splitGroup.name : "Unknown Group";

            const splitCategory = await this.categoryModel.findOne({
                categoryName: SPLITWISE_DEFAULTS.CATEGORIES.SPLIT_EXPENSE.categoryName,
                userId: expenseDto.paidBy
            }).exec();

            if (splitCategory) {
                const existingExpense = await this.expensesModel.findOne({
                    userId: expenseDto.paidBy,
                    categoryId: splitCategory.categoryId,
                    name: { $regex: `Split Expense.*` }
                }).exec();

                const expensePayload: CreateExpenseDto = {
                    userId: expenseDto.paidBy,
                    categoryId: splitCategory.categoryId,
                    name: SPLITWISE_DEFAULTS.CATEGORIES.SPLIT_EXPENSE.expenseName(groupName),
                    expenseType: "Expense",
                    amount: expenseDto.amount,
                    description: SPLITWISE_DEFAULTS.CATEGORIES.SPLIT_EXPENSE.expenseDescription(expenseDto.title, groupName),
                    createdAt: existingExpense ? existingExpense.createdAt : now,
                    updatedAt: now
                };

                if (existingExpense) {
                    await this.expensesModel.updateOne(
                        { _id: existingExpense._id },
                        { $set: expensePayload }
                    );
                } else {
                    await this.expensesModel.create(expensePayload);
                }
            }

            const populatedExpense = await this.splitExpenseModel.aggregate([
                { $match: { splitExpenseId: Number(splitExpenseId) } },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'paidBy',
                        foreignField: 'id',
                        as: 'paidByObj'
                    }
                },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'splitBetween',
                        foreignField: 'id',
                        as: 'splitBetweenObjs'
                    }
                },
                {
                    $addFields: {
                        paidBy: {
                            $cond: [
                                { $gt: [{ $size: "$paidByObj" }, 0] },
                                { userId: { $arrayElemAt: ["$paidByObj.id", 0] }, name: { $arrayElemAt: ["$paidByObj.name", 0] } },
                                { userId: null, name: "Unknown" }
                            ]
                        },
                        splitBetween: {
                            $map: { input: "$splitBetweenObjs", as: "u", in: { userId: "$$u.id", name: "$$u.name" } }
                        }
                    }
                },
                { $project: { paidByObj: 0, splitBetweenObjs: 0, __v: 0 } }
            ]);

            const expenseData = populatedExpense[0];
            if (!expenseData) {
                return res.status(500).json({ status: 500, success: false, message: MESSAGE.ERROR.FAILED_TO_FETCH_UPDATED_EXPENSE });
            }

            return res.status(200).json({ status: 200, success: true, message: MESSAGE.SUCCESS.EXPENSE_UPDATED, data: expenseData });

        } catch (error) {
            console.error('Error updating expense:', error);
            return res.status(500).json({ status: 500, success: false, message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` });
        }
    }

    async createSplitSettleUp(expenseDto: SettleDataDto, res: Response): Promise<Response> {
        try {
            const { splitGroupId, from, to, amount } = expenseDto;
            const now = Date.now();

            const lastExpense = await this.splitExpenseModel.findOne().sort({ splitExpenseId: -1 }).exec();
            const newId = lastExpense ? lastExpense.splitExpenseId + 1 : Date.now();

            const group = await this.splitGroupsModel.findOne({ splitGroupId }).exec();
            const groupName = group ? group.name : "Unknown Group";

            const fromUser = await this.userModel.findOne({ id: from }).exec();
            const toUser = await this.userModel.findOne({ id: to }).exec();
            const fromName = fromUser ? fromUser.name : `User ${from}`;
            const toName = toUser ? toUser.name : `User ${to}`;

            const newExpense = new this.splitExpenseModel({
                splitGroupId,
                paidBy: from,
                splitBetween: [to],
                title: "Settle Up",
                amount,
                splitExpenseId: newId,
                createdAt: now,
                updatedAt: now,
            });
            await newExpense.save();

            const catPaid = await this.categoryModel.findOne({
                categoryName: SPLITWISE_DEFAULTS.CATEGORIES.SETTLEMENT_PAID.categoryName,
                userId: from
            }).exec();

            if (catPaid) {
                await this.expensesModel.create({
                    userId: from,
                    categoryId: catPaid.categoryId,
                    name: SPLITWISE_DEFAULTS.CATEGORIES.SETTLEMENT_PAID.expenseName(groupName),
                    expenseType: "Expense",
                    amount,
                    description: SPLITWISE_DEFAULTS.CATEGORIES.SETTLEMENT_PAID.expenseDescription(toName, groupName),
                    createdAt: now,
                    updatedAt: now
                });
            }

            if (to !== from) {
                const catRecv = await this.categoryModel.findOne({
                    categoryName: SPLITWISE_DEFAULTS.CATEGORIES.SETTLEMENT_RECEIVED.categoryName,
                    userId: to
                }).exec();

                if (catRecv) {
                    await this.expensesModel.create({
                        userId: to,
                        categoryId: catRecv.categoryId,
                        name: SPLITWISE_DEFAULTS.CATEGORIES.SETTLEMENT_RECEIVED.expenseName(groupName),
                        expenseType: "Income",
                        amount,
                        description: SPLITWISE_DEFAULTS.CATEGORIES.SETTLEMENT_RECEIVED.expenseDescription(fromName, groupName),
                        createdAt: now,
                        updatedAt: now
                    });
                }
            }

            const populatedExpense = {
                ...newExpense.toObject(),
                paidBy: { userId: from, name: fromName },
                splitBetween: [{ userId: to, name: toName }]
            };

            return res.status(200).json({ status: 200, success: true, message: MESSAGE.SUCCESS.SETTLE_UP_CREATED, data: populatedExpense });

        } catch (error) {
            console.error("Error creating settle up:", error);
            return res.status(500).json({ status: 500, success: false, message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` });
        }
    }

    async updateSplitSettleUp(expenseDto: SettleDataDto, res: Response): Promise<Response> {
        try {
            const { splitExpenseId, splitGroupId, from, to, amount } = expenseDto;
            const now = Date.now();

            const splitExpenseIdNum = Number(splitExpenseId);
            const fromId = Number(from);
            const toId = Number(to);

            const existing = await this.splitExpenseModel.findOne({ splitExpenseId: splitExpenseIdNum }).exec();
            if (!existing) {
                return res.status(404).json({ status: 404, success: false, message: MESSAGE.ERROR.SETTLE_UP_RECORD_NOT_FOUND });
            }

            const prevFrom = Number(existing.paidBy);
            const prevTo = Number(existing.splitBetween[0]);
            const swapOccurred = prevFrom !== fromId || prevTo !== toId;

            const group = await this.splitGroupsModel.findOne({ splitGroupId }).exec();
            const groupName = group ? group.name : "Unknown Group";

            const fromUser = await this.userModel.findOne({ id: fromId }).exec();
            const toUser = await this.userModel.findOne({ id: toId }).exec();
            const fromName = fromUser ? fromUser.name : `User ${fromId}`;
            const toName = toUser ? toUser.name : `User ${toId}`;

            await this.splitExpenseModel.updateOne(
                { splitExpenseId: splitExpenseIdNum },
                { $set: { paidBy: fromId, splitBetween: [toId], amount, updatedAt: now } }
            );

            const catPaidPrev = await this.categoryModel.findOne({
                categoryName: SPLITWISE_DEFAULTS.CATEGORIES.SETTLEMENT_PAID.categoryName,
                userId: prevFrom
            }).exec();

            const catRecvPrev = await this.categoryModel.findOne({
                categoryName: SPLITWISE_DEFAULTS.CATEGORIES.SETTLEMENT_RECEIVED.categoryName,
                userId: prevTo
            }).exec();

            const recalcExpenseGoal = async (userId: number, categoryId: number) => {
                const startOfMonth = new Date();
                startOfMonth.setDate(1);
                startOfMonth.setHours(0, 0, 0, 0);
                const endOfMonth = new Date(startOfMonth);
                endOfMonth.setMonth(endOfMonth.getMonth() + 1);

                const total = await this.expensesModel.aggregate([
                    { $match: { userId, categoryId, createdAt: { $gte: startOfMonth.getTime(), $lt: endOfMonth.getTime() } } },
                    { $group: { _id: null, total: { $sum: "$amount" } } }
                ]);

                const currentAmount = total.length > 0 ? total[0].total : 0;
                await this.expenseGoalModel.findOneAndUpdate(
                    { userId, categoryId },
                    { $set: { currentAmount, updatedAt: now } },
                    { new: true, upsert: true }
                );
            };

            const updateExpenseAndGoal = async (
                oldUserId: number,
                newUserId: number,
                oldCategoryId: number,
                newCategoryId: number,
                name: string,
                type: string,
                desc: string
            ) => {
                await this.expensesModel.updateOne(
                    { userId: oldUserId, categoryId: oldCategoryId, createdAt: existing.createdAt },
                    { $set: { userId: newUserId, categoryId: newCategoryId, name, expenseType: type, amount, description: desc, updatedAt: now } }
                );
                await recalcExpenseGoal(newUserId, newCategoryId);

                if (oldUserId !== newUserId || oldCategoryId !== newCategoryId) {
                    await recalcExpenseGoal(oldUserId, oldCategoryId);
                }
            };

            if (swapOccurred) {
                if (catPaidPrev) {
                    const catRecvNew = await this.categoryModel.findOne({
                        categoryName: SPLITWISE_DEFAULTS.CATEGORIES.SETTLEMENT_RECEIVED.categoryName,
                        userId: toId
                    }).exec();
                    if (catRecvNew) {
                        await updateExpenseAndGoal(
                            prevFrom,
                            toId,
                            catPaidPrev.categoryId,
                            catRecvNew.categoryId,
                            SPLITWISE_DEFAULTS.CATEGORIES.SETTLEMENT_RECEIVED.expenseName(groupName),
                            "Income",
                            SPLITWISE_DEFAULTS.CATEGORIES.SETTLEMENT_RECEIVED.expenseDescription(fromName, groupName)
                        );
                    }
                }

                if (catRecvPrev) {
                    const catPaidNew = await this.categoryModel.findOne({
                        categoryName: SPLITWISE_DEFAULTS.CATEGORIES.SETTLEMENT_PAID.categoryName,
                        userId: fromId
                    }).exec();
                    if (catPaidNew) {
                        await updateExpenseAndGoal(
                            prevTo,
                            fromId,
                            catRecvPrev.categoryId,
                            catPaidNew.categoryId,
                            SPLITWISE_DEFAULTS.CATEGORIES.SETTLEMENT_PAID.expenseName(groupName),
                            "Expense",
                            SPLITWISE_DEFAULTS.CATEGORIES.SETTLEMENT_PAID.expenseDescription(toName, groupName)
                        );
                    }
                }
            } else {
                if (catPaidPrev) {
                    await updateExpenseAndGoal(
                        fromId,
                        fromId,
                        catPaidPrev.categoryId,
                        catPaidPrev.categoryId,
                        SPLITWISE_DEFAULTS.CATEGORIES.SETTLEMENT_PAID.expenseName(groupName),
                        "Expense",
                        SPLITWISE_DEFAULTS.CATEGORIES.SETTLEMENT_PAID.expenseDescription(toName, groupName)
                    );
                }

                if (catRecvPrev) {
                    await updateExpenseAndGoal(
                        toId,
                        toId,
                        catRecvPrev.categoryId,
                        catRecvPrev.categoryId,
                        SPLITWISE_DEFAULTS.CATEGORIES.SETTLEMENT_RECEIVED.expenseName(groupName),
                        "Income",
                        SPLITWISE_DEFAULTS.CATEGORIES.SETTLEMENT_RECEIVED.expenseDescription(fromName, groupName)
                    );
                }
            }

            const responseExpense = {
                ...existing.toObject(),
                paidBy: { userId: fromId, name: fromName },
                splitBetween: [{ userId: toId, name: toName }],
                updatedAt: now
            };

            return res.status(200).json({ status: 200, success: true, message: MESSAGE.SUCCESS.SETTLE_UP_UPDATED, data: responseExpense });

        } catch (error) {
            console.error("Error updating settle up:", error);
            return res.status(500).json({ status: 500, success: false, message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` });
        }
    }

    async deleteExpense(splitExpenseId: number, res: Response): Promise<Response> {
        try {
            const expense = await this.splitExpenseModel.findOne({ splitExpenseId }).exec();
            if (!expense) {
                return res.status(404).json({ status: 404, success: false, message: 'Expense not found' });
            }

            const { paidBy, splitBetween, createdAt, title } = expense;
            const isSettleUp = title === "Settle Up";

            await this.splitExpenseModel.deleteOne({ splitExpenseId });

            if (!isSettleUp) {
                const splitCategory = await this.categoryModel.findOne({
                    categoryName: SPLITWISE_DEFAULTS.CATEGORIES.SPLIT_EXPENSE.categoryName,
                    userId: paidBy
                }).exec();

                if (splitCategory) {
                    await this.expensesModel.deleteOne({
                        userId: paidBy,
                        categoryId: splitCategory.categoryId,
                        createdAt
                    }).exec();
                }
            } else {
                const from = Number(paidBy);
                const to = Number(splitBetween[0]);

                const catPaid = await this.categoryModel.findOne({
                    categoryName: SPLITWISE_DEFAULTS.CATEGORIES.SETTLEMENT_PAID.categoryName,
                    userId: from
                }).exec();

                if (catPaid) {
                    await this.expensesModel.deleteOne({
                        userId: from,
                        categoryId: catPaid.categoryId,
                        createdAt
                    }).exec();
                }

                if (to !== from) {
                    const catRecv = await this.categoryModel.findOne({
                        categoryName: SPLITWISE_DEFAULTS.CATEGORIES.SETTLEMENT_RECEIVED.categoryName,
                        userId: to
                    }).exec();

                    if (catRecv) {
                        await this.expensesModel.deleteOne({
                            userId: to,
                            categoryId: catRecv.categoryId,
                            createdAt
                        }).exec();
                    }
                }
            }

            return res.status(200).json({ status: 200, success: true, message: `${isSettleUp ? "Settle Up" : SPLITWISE_DEFAULTS.CATEGORIES.SPLIT_EXPENSE.categoryName} deleted successfully` });
        } catch (error) {
            console.error('Error deleting expense:', error);
            return res.status(500).json({ status: 500, success: false, message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` });
        }
    }
}