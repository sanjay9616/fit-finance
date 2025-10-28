import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Response } from 'express';
import { SplitGroup } from './splitGroups.schema';
import { SplitGroupDto } from 'config/interfaces';
import { Category, CategoryDocument } from 'src/category/category.schema';
import { ExpenseGoal, ExpenseGoalDocument } from 'src/expense-goal/expense-goal.schema';
import { SPLITWISE_DEFAULTS } from 'config/constant';
import { MESSAGE } from 'config/message';

@Injectable()
export class SplitGroupsService {
    constructor(
        @InjectModel(SplitGroup.name) private splitGroupModel: Model<SplitGroup>,
        @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
        @InjectModel(ExpenseGoal.name) private readonly expenseGoalModel: Model<ExpenseGoalDocument>,
    ) { }

    private async ensureCategories(userId: number, now: number) {
        const categoriesToCheck = [
            {
                categoryName: SPLITWISE_DEFAULTS.CATEGORIES.SPLIT_EXPENSE.categoryName,
                expenseType: "Expense",
                description: SPLITWISE_DEFAULTS.CATEGORIES.SPLIT_EXPENSE.goalDescription
            },
            {
                categoryName: SPLITWISE_DEFAULTS.CATEGORIES.SETTLEMENT_PAID.categoryName,
                expenseType: "Expense",
                description: SPLITWISE_DEFAULTS.CATEGORIES.SETTLEMENT_PAID.goalDescription
            },
            {
                categoryName: SPLITWISE_DEFAULTS.CATEGORIES.SETTLEMENT_RECEIVED.categoryName,
                expenseType: "Income",
                description: SPLITWISE_DEFAULTS.CATEGORIES.SETTLEMENT_RECEIVED.goalDescription
            },
        ];

        const categoryIds: { [key: string]: number } = {};

        for (const cat of categoriesToCheck) {
            let existingCat = await this.categoryModel.findOne({
                userId,
                categoryName: cat.categoryName,
            });

            let categoryId: number;
            if (!existingCat) {
                const lastCategory = await this.categoryModel
                    .findOne()
                    .sort({ categoryId: -1 })
                    .exec();
                categoryId = lastCategory ? lastCategory.categoryId + 1 : 1;

                const newCategory = new this.categoryModel({
                    userId,
                    categoryId,
                    categoryName: cat.categoryName,
                    expenseType: cat.expenseType,
                    createdAt: now,
                    updatedAt: now,
                });
                await newCategory.save();
            } else {
                categoryId = existingCat.categoryId;
            }

            categoryIds[cat.categoryName] = categoryId;

            await this.ensureExpenseGoal(userId, categoryId, cat.expenseType, cat.description, now);
        }

        return categoryIds;
    }

    private async ensureExpenseGoal(userId: number, categoryId: number, expenseType: string, description: string, now: number) {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const endOfMonth = new Date(startOfMonth);
        endOfMonth.setMonth(endOfMonth.getMonth() + 1);

        const existingGoal = await this.expenseGoalModel.findOne({
            userId,
            categoryId,
            createdAt: { $gte: startOfMonth.getTime(), $lt: endOfMonth.getTime() },
        });

        if (!existingGoal) {
            const newGoal = new this.expenseGoalModel({
                userId,
                categoryId,
                expenseType,
                targetAmount: 0,
                description,
                createdAt: now,
                updatedAt: now,
            });
            await newGoal.save();
        }
    }

    private async populateGroupMembers(splitGroupId: number) {
        const groupWithMembers = await this.splitGroupModel.aggregate([
            { $match: { splitGroupId } },
            {
                $lookup: {
                    from: "users",
                    localField: "members",
                    foreignField: "id",
                    as: "members",
                },
            },
            {
                $project: {
                    _id: 1,
                    splitGroupId: 1,
                    name: 1,
                    members: {
                        $map: {
                            input: "$members",
                            as: "m",
                            in: { userId: "$$m.id", name: "$$m.name" },
                        },
                    },
                    createdAt: 1,
                    updatedAt: 1,
                    __v: 1,
                },
            },
        ]);

        return groupWithMembers[0];
    }

    async createGroup(groupDto: SplitGroupDto, res: Response): Promise<Response> {
        try {
            const now = Date.now();

            const lastGroup = await this.splitGroupModel
                .findOne()
                .sort({ splitGroupId: -1 })
                .exec();
            const newId = lastGroup ? lastGroup.splitGroupId + 1 : 1;

            const newGroup = new this.splitGroupModel({
                ...groupDto,
                splitGroupId: newId,
                createdAt: now,
                updatedAt: now,
            });
            await newGroup.save();

            for (const userId of groupDto.members) {
                await this.ensureCategories(userId, now);
            }

            const groupData = await this.populateGroupMembers(newId);

            return res.status(200).json({ status: 200, success: true, message: MESSAGE.SUCCESS.SPLIT_GROUP_CREATED, data: groupData, });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ status: 500, success: false, message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` });
        }
    }

    async getAllGroups(userId: number, res: Response): Promise<Response> {
        try {
            const groupsWithMembers = await this.splitGroupModel.aggregate([
                { $match: { members: userId } },
                { $sort: { createdAt: -1 } },
                {
                    $lookup: {
                        from: "users",
                        localField: "members",
                        foreignField: "id",
                        as: "members"
                    }
                },
                {
                    $project: {
                        _id: 1,
                        splitGroupId: 1,
                        name: 1,
                        members: {
                            $map: {
                                input: "$members",
                                as: "m",
                                in: { userId: "$$m.id", name: "$$m.name" }
                            }
                        },
                        createdAt: 1,
                        updatedAt: 1
                    }
                }
            ]);

            return res.status(200).json({ status: 200, success: true, message: MESSAGE.SUCCESS.SPLIT_GROUP_FETCHED, data: groupsWithMembers });
        } catch (error) {
            console.error('Error fetching groups:', error.message || error);
            return res.status(500).json({ status: 500, success: false, message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` });
        }
    }

    async updateGroup(splitGroupId: number, groupDto: any, res: Response): Promise<Response> {
        try {
            const now = Date.now();

            await this.splitGroupModel.updateOne(
                { splitGroupId },
                { ...groupDto, updatedAt: now }
            ).exec();

            for (const userId of groupDto.members) {
                await this.ensureCategories(userId, now);
            }

            const updatedGroup = await this.populateGroupMembers(Number(splitGroupId));

            if (!updatedGroup) {
                return res.status(404).json({ status: 404, success: false, message: 'Group not found' });
            }

            return res.status(200).json({ status: 200, success: true, message: MESSAGE.SUCCESS.SPLIT_GROUP_UPDATED, data: updatedGroup });

        } catch (error) {
            console.error('Error updating group:', error);
            return res.status(500).json({ status: 500, success: false, message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` });
        }
    }
}
