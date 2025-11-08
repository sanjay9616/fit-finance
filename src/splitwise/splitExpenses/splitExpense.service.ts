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
import { SplitActivity, SplitActivityDocument } from '../split-activity.schema';

@Injectable()
export class SplitExpenseService {
    constructor(
        @InjectModel(SplitGroup.name) private readonly splitGroupsModel: Model<SplitGroupDocument>,
        @InjectModel(SplitExpense.name) private readonly splitExpenseModel: Model<SplitExpenseDocument>,
        @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
        @InjectModel(ExpenseGoal.name) private readonly expenseGoalModel: Model<ExpenseGoalDocument>,
        @InjectModel(Expense.name) private readonly expensesModel: Model<ExpenseDocument>,
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
        @InjectModel(SplitActivity.name) private splitActivityModel: Model<SplitActivityDocument>
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
            const user = await this.userModel.findOne({ id: paidBy }).exec();
            const userName = user ? user.name : `User ${paidBy}`;
            const lastAudit = await this.splitActivityModel.findOne().sort({ auditId: -1 }).exec();
            const newAuditId = lastAudit ? lastAudit.auditId + 1 : Date.now();
            await this.splitActivityModel.create({
                auditId: newAuditId,
                splitGroupId,
                splitGroupName: groupName,
                userId: paidBy,
                userName,
                action: "CREATE_EXPENSE",
                title,
                description: [`${userName} added expense "${title}" in ${groupName}`],
                timestamp: now,
            });
            const splitCategory = await this.categoryModel.findOne({
                categoryName: SPLITWISE_DEFAULTS.CATEGORIES.SPLIT_EXPENSE.categoryName,
                userId: paidBy,
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
                    updatedAt: now,
                });
            }
            return res.status(200).json({ status: 200, success: true, message: MESSAGE.SUCCESS.SPLIT_EXPENSE_CREATED, data: newExpense });

        } catch (error) {
            console.error("Error creating split expense:", error);
            return res.status(500).json({ status: 500, success: false, message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` });
        }
    }

    async updateSplitExpense(splitExpenseId: number, expenseDto: SplitExpenseDto, res: Response): Promise<Response> {
        try {
            const now = Date.now();
            const oldExpense = await this.splitExpenseModel.findOne({ splitExpenseId }).lean();
            if (!oldExpense) {
                return res.status(404).json({ status: 404, success: false, message: MESSAGE.ERROR.EXPENSE_NOT_FOUND });
            }
            const { _id, __v, createdAt, updatedAt, ...updateData } = expenseDto;
            await this.splitExpenseModel.updateOne(
                { splitExpenseId },
                { ...updateData, updatedAt: now }
            );
            const allMemberIds = Array.from(new Set([
                expenseDto.paidBy,
                ...expenseDto.splitBetween,
                oldExpense.paidBy,
                ...(oldExpense.splitBetween || [])
            ]));

            const users = await this.userModel.find({ id: { $in: allMemberIds } }).lean();
            const getUser = (id: number) => users.find(u => u.id === id)?.name || "Unknown";
            const descriptionMsgs: string[] = [];
            if (oldExpense.title !== expenseDto.title) {
                descriptionMsgs.push(`Title changed from "${oldExpense.title}" to "${expenseDto.title}"`);
            }
            if (oldExpense.amount !== expenseDto.amount) {
                descriptionMsgs.push(`Amount changed from ₹${oldExpense.amount} to ₹${expenseDto.amount}`);
            }
            const oldMembers = new Set(oldExpense.splitBetween);
            const newMembers = new Set(expenseDto.splitBetween);
            const removedMembers = [...oldMembers].filter(id => !newMembers.has(id));
            const addedMembers = [...newMembers].filter(id => !oldMembers.has(id));
            if (removedMembers.length > 0) {
                descriptionMsgs.push(`Removed members: ${removedMembers.map(getUser).join(", ")}`);
            }
            if (addedMembers.length > 0) {
                descriptionMsgs.push(`Added members: ${addedMembers.map(getUser).join(", ")}`);
            }
            if (descriptionMsgs.length > 0) {
                const perShare = Number((expenseDto.amount / expenseDto.splitBetween.length).toFixed(2));
                expenseDto.splitBetween.forEach(uid => {
                    if (uid !== expenseDto.paidBy) {
                        descriptionMsgs.push(`${getUser(expenseDto.paidBy)} gets ₹${perShare} from ${getUser(uid)}`);
                    }
                });
                const lastAudit = await this.splitActivityModel.findOne().sort({ auditId: -1 }).exec();
                const newAuditId = lastAudit ? lastAudit.auditId + 1 : Date.now();
                await this.splitActivityModel.create({
                    auditId: newAuditId,
                    splitGroupId: expenseDto.splitGroupId,
                    splitExpenseId,
                    userId: expenseDto.updatedBy,
                    action: "UPDATE_EXPENSE",
                    title: expenseDto.title,
                    description: descriptionMsgs,
                    timestamp: now
                });
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
                                {
                                    userId: { $arrayElemAt: ["$paidByObj.id", 0] },
                                    name: { $arrayElemAt: ["$paidByObj.name", 0] }
                                },
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

            const lastAudit = await this.splitActivityModel.findOne().sort({ auditId: -1 }).exec();
            const newAuditId = lastAudit ? lastAudit.auditId + 1 : Date.now();
            const description = [`${fromName} paid ₹${amount} to ${toName}`];

            await this.splitActivityModel.create({
                auditId: newAuditId,
                splitGroupId,
                userId: from,
                splitExpenseId: newId,
                action: "CREATE_SETTLE_UP",
                title: "Settle Up",
                description,
                timestamp: now
            });

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
            const { splitExpenseId, splitGroupId, from, to, amount, updatedBy } = expenseDto;
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
            const prevAmount = existing.amount;
            const payerChanged = prevFrom !== fromId;
            const receiverChanged = prevTo !== toId;
            const amountChanged = prevAmount !== amount;
            const bothChanged = payerChanged && receiverChanged;
            const group = await this.splitGroupsModel.findOne({ splitGroupId }).exec();
            const groupName = group ? group.name : "Unknown Group";
            const [fromUser, toUser, updatedByUser, prevFromUser, prevToUser] = await Promise.all([
                this.userModel.findOne({ id: fromId }).exec(),
                this.userModel.findOne({ id: toId }).exec(),
                this.userModel.findOne({ id: updatedBy }).exec(),
                this.userModel.findOne({ id: prevFrom }).exec(),
                this.userModel.findOne({ id: prevTo }).exec(),
            ]);
            const fromName = fromUser ? fromUser.name : `User ${fromId}`;
            const toName = toUser ? toUser.name : `User ${toId}`;
            const updatedByName = updatedByUser ? updatedByUser.name : `User ${updatedBy}`;
            const prevFromName = prevFromUser ? prevFromUser.name : `User ${prevFrom}`;
            const prevToName = prevToUser ? prevToUser.name : `User ${prevTo}`;
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
                    {
                        $match: {
                            userId,
                            categoryId,
                            createdAt: { $gte: startOfMonth.getTime(), $lt: endOfMonth.getTime() }
                        }
                    },
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
                    {
                        $set: {
                            userId: newUserId,
                            categoryId: newCategoryId,
                            name,
                            expenseType: type,
                            amount,
                            description: desc,
                            updatedAt: now
                        }
                    }
                );
                await recalcExpenseGoal(newUserId, newCategoryId);
                if (oldUserId !== newUserId || oldCategoryId !== newCategoryId) {
                    await recalcExpenseGoal(oldUserId, oldCategoryId);
                }
            };
            if (bothChanged) {
                await this.expensesModel.deleteMany({
                    $or: [{ userId: prevFrom }, { userId: prevTo }],
                    createdAt: existing.createdAt
                });
                const catPaidNew = await this.categoryModel.findOne({
                    categoryName: SPLITWISE_DEFAULTS.CATEGORIES.SETTLEMENT_PAID.categoryName,
                    userId: fromId
                }).exec();
                const catRecvNew = await this.categoryModel.findOne({
                    categoryName: SPLITWISE_DEFAULTS.CATEGORIES.SETTLEMENT_RECEIVED.categoryName,
                    userId: toId
                }).exec();
                if (catPaidNew && catRecvNew) {
                    await this.expensesModel.create([
                        {
                            userId: fromId,
                            categoryId: catPaidNew.categoryId,
                            name: SPLITWISE_DEFAULTS.CATEGORIES.SETTLEMENT_PAID.expenseName(groupName),
                            expenseType: "Expense",
                            amount,
                            description: SPLITWISE_DEFAULTS.CATEGORIES.SETTLEMENT_PAID.expenseDescription(toName, groupName),
                            createdAt: existing.createdAt,
                            updatedAt: now
                        },
                        {
                            userId: toId,
                            categoryId: catRecvNew.categoryId,
                            name: SPLITWISE_DEFAULTS.CATEGORIES.SETTLEMENT_RECEIVED.expenseName(groupName),
                            expenseType: "Income",
                            amount,
                            description: SPLITWISE_DEFAULTS.CATEGORIES.SETTLEMENT_RECEIVED.expenseDescription(fromName, groupName),
                            createdAt: existing.createdAt,
                            updatedAt: now
                        }
                    ]);

                    await Promise.all([
                        recalcExpenseGoal(fromId, catPaidNew.categoryId),
                        recalcExpenseGoal(toId, catRecvNew.categoryId)
                    ]);
                }
            }
            else if (payerChanged || receiverChanged) {
                if (payerChanged && catRecvPrev) {
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
                if (receiverChanged && catPaidPrev) {
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
            }
            else if (amountChanged) {
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
            const description: string[] = [];
            if (payerChanged) description.push(`Changed payer from ${prevFromName} to ${fromName}`);
            if (receiverChanged) description.push(`Changed receiver from ${prevToName} to ${toName}`);
            if (amountChanged) description.push(`Updated settle up amount from ₹${prevAmount} to ₹${amount}`);
            if (description.length > 0) {
                await this.splitActivityModel.create({
                    auditId: Date.now(),
                    splitGroupId,
                    userId: updatedBy,
                    action: "UPDATE_SETTLE_UP",
                    title: `${updatedByName} updated Settle Up in ${groupName}`,
                    description,
                    timestamp: now,
                });
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
            const { splitGroupId, paidBy, splitBetween, amount, createdAt, title } = expense;
            const isSettleUp = title === "Settle Up";
            await this.splitExpenseModel.deleteOne({ splitExpenseId });
            const group = await this.splitGroupsModel.findOne({ splitGroupId }).exec();
            const groupName = group ? group.name : "Unknown Group";

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
                const share = amount / splitBetween.length;
                const payer = await this.userModel.findOne({ id: paidBy }).exec();
                const payerName = payer?.name || "User";
                const description: string[] = [];
                for (const uid of splitBetween) {
                    if (uid !== paidBy) {
                        const user = await this.userModel.findOne({ id: uid }).exec();
                        const userName = user?.name || "User";
                        description.push(`${payerName} gets ₹${share.toFixed(2)} from ${userName}`);
                    }
                }
                const lastAudit = await this.splitActivityModel.findOne().sort({ auditId: -1 }).exec();
                const newAuditId = lastAudit ? lastAudit.auditId + 1 : Date.now();
                await this.splitActivityModel.create({
                    auditId: newAuditId,
                    splitGroupId,
                    userId: paidBy,
                    action: "DELETE_EXPENSE",
                    title: `${payerName} deleted expense in ${groupName}`,
                    description,
                    timestamp: Date.now()
                });

            } else {
                const from = Number(paidBy);
                const to = Number(splitBetween[0]);
                const fromUser = await this.userModel.findOne({ id: from }).exec();
                const toUser = await this.userModel.findOne({ id: to }).exec();
                const fromName = fromUser?.name || `User ${from}`;
                const toName = toUser?.name || `User ${to}`;
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
                const lastAudit = await this.splitActivityModel.findOne().sort({ auditId: -1 }).exec();
                const newAuditId = lastAudit ? lastAudit.auditId + 1 : Date.now();
                await this.splitActivityModel.create({
                    auditId: newAuditId,
                    splitGroupId,
                    userId: from,
                    action: "DELETE_SETTLE_UP",
                    title: `${fromName} deleted Settle Up in ${groupName}`,
                    description: [`${fromName} paid ₹${amount} to ${toName}`],
                    timestamp: Date.now()
                });
            }

            return res.status(200).json({ status: 200, success: true, message: `${isSettleUp ? "Settle Up" : SPLITWISE_DEFAULTS.CATEGORIES.SPLIT_EXPENSE.categoryName} deleted successfully` });

        } catch (error) {
            console.error('Error deleting expense:', error);
            return res.status(500).json({ status: 500, success: false, message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` });
        }
    }

    async getSplitActivity(splitGroupId: number, res: Response): Promise<Response> {
        try {
            const activities = await this.splitActivityModel
                .find({ splitGroupId })
                .sort({ timestamp: -1 })
                .exec();

            const userIds = [...new Set(activities.map(a => a.userId))];
            const groupIds = [...new Set(activities.map(a => a.splitGroupId))];
            const users = await this.userModel.find({ id: { $in: userIds } }).exec();
            const userMap = new Map(users.map(u => [u.id, u.name]));
            const groups = await this.splitGroupsModel.find({ splitGroupId: { $in: groupIds } }).exec();
            const groupMap = new Map(groups.map(g => [g.splitGroupId, g.name]));
            const enrichedActivities = activities.map(activity => ({
                ...activity.toObject(),
                userName: userMap.get(activity.userId) || "Unknown User",
                splitGroupName: groupMap.get(activity.splitGroupId) || "Unknown Group"
            }));

            return res.status(200).json({ status: 200, success: true, message: MESSAGE.SUCCESS.SETTLE_ACTIVITY_FETCHED, data: enrichedActivities });
        } catch (error) {
            console.error("Error fetching activity:", error);
            return res.status(500).json({ status: 500, success: false, message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` });
        }
    }
}