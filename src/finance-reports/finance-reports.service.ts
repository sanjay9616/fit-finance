import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Response } from 'express';
import { Expense, ExpenseDocument } from 'src/expense/expense.schema';
import { ExpenseGoal, ExpenseGoalDocument } from 'src/expense-goal/expense-goal.schema';
import { User, UserDocument } from 'src/user/user.schema';
import { Category, CategoryDocument } from 'src/category/category.schema';
import { MESSAGE } from 'config/message';

@Injectable()
export class FinanceReportsService {
    constructor(
        @InjectModel(Expense.name) private expenseModel: Model<ExpenseDocument>,
        @InjectModel(ExpenseGoal.name) private expenseGoalModel: Model<ExpenseGoalDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    ) { }

    async getFinanceReport(res: Response, payload: { userId: number; from: number; to: number }): Promise<Response> {
        try {
            const { userId, from, to } = payload;

            // 1. Fetch User
            const user = await this.userModel.findOne({ id: userId });
            const userName = user ? user.name : 'Unknown User';

            // 2. Fetch all Categories (for mapping names)
            const categories = await this.categoryModel.find({ userId });
            const categoryMap = new Map(categories.map(c => [c.categoryId, c.categoryName]));

            // 3. Aggregate unique goals in the selected range
            const goalAggregates = await this.expenseGoalModel.aggregate([
                {
                    $match: {
                        userId,
                        createdAt: { $gte: Number(from), $lte: Number(to) }
                    }
                },
                {
                    $group: {
                        _id: { categoryId: "$categoryId", expenseType: "$expenseType" },
                        targetAmount: { $sum: "$targetAmount" },
                        createdAt: { $min: "$createdAt" },
                        updatedAt: { $max: "$updatedAt" }
                    }
                }
            ]);

            // 4. For each goal group, aggregate expenses in the same range
            const responseItems = await Promise.all(goalAggregates.map(async (goalGroup) => {
                const { categoryId, expenseType } = goalGroup._id;

                const totalExpenses = await this.expenseModel.aggregate([
                    {
                        $match: {
                            userId,
                            categoryId: categoryId,
                            expenseType: expenseType,
                            createdAt: { $gte: Number(from), $lte: Number(to) }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            totalAmount: { $sum: "$amount" }
                        }
                    }
                ]);

                const amount = totalExpenses.length > 0 ? totalExpenses[0].totalAmount : 0;

                return {
                    userId: userId,
                    categoryId: categoryId,
                    categoryName: categoryMap.get(categoryId) || 'Unknown',
                    expenseType: expenseType,
                    amount: amount,
                    targetAmount: goalGroup.targetAmount,
                    createdAt: goalGroup.createdAt,
                    updatedAt: goalGroup.updatedAt || goalGroup.createdAt,
                    userName: userName
                };
            }));

            return res.status(200).json({ status: 200, success: true, message: 'Report generated successfully', data: responseItems });

        } catch (error) {
            console.error('Error generating report:', error);
            return res.status(500).json({ status: 500, success: false, message: 'Error generating report' });
        }
    }

    async downloadFinanceReportPdf(res: Response, payload: { userId: number; from: number; to: number }): Promise<void> {
        try {
            const { userId, from, to } = payload;

            // 1. Fetch User
            const user = await this.userModel.findOne({ id: userId });
            const userName = user ? user.name : 'Unknown User';

            // 2. Fetch all Categories
            const categories = await this.categoryModel.find({ userId });
            const categoryMap = new Map(categories.map(c => [c.categoryId, c.categoryName]));

            // 3. Aggregate goals
            const goalAggregates = await this.expenseGoalModel.aggregate([
                { $match: { userId, createdAt: { $gte: Number(from), $lte: Number(to) } } },
                {
                    $group: {
                        _id: { categoryId: "$categoryId", expenseType: "$expenseType" },
                        targetAmount: { $sum: "$targetAmount" }
                    }
                }
            ]);

            const responseItems = await Promise.all(goalAggregates.map(async (goalGroup) => {
                const { categoryId, expenseType } = goalGroup._id;
                const totalExpenses = await this.expenseModel.aggregate([
                    { $match: { userId, categoryId, expenseType, createdAt: { $gte: Number(from), $lte: Number(to) } } },
                    { $group: { _id: null, totalAmount: { $sum: "$amount" } } }
                ]);
                const amount = totalExpenses.length > 0 ? totalExpenses[0].totalAmount : 0;
                return {
                    categoryName: categoryMap.get(categoryId) || 'Unknown',
                    expenseType,
                    amount,
                    targetAmount: goalGroup.targetAmount,
                };
            }));

            // Totals
            let totalIncome = 0;
            let totalSpent = 0;
            let totalSavings = 0;
            responseItems.forEach(item => {
                if (item.expenseType === 'Income') totalIncome += item.amount;
                else if (item.expenseType === 'Expense') totalSpent += item.amount;
                else if (item.expenseType === 'Saving') totalSavings += item.amount;
            });
            const totalBalance = totalIncome - totalSpent - totalSavings;

            // PDF Generation
            const doc = new PDFDocument({ margin: 50 });
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=FinanceReport_${userId}.pdf`);
            doc.pipe(res);

            // Header
            doc.fontSize(25).text('FitFinance Report', { align: 'center' });
            doc.moveDown();
            doc.fontSize(12).text(`User: ${userName}`);
            doc.text(`Period: ${new Date(from).toLocaleDateString()} - ${new Date(to).toLocaleDateString()}`);
            doc.moveDown();

            // Summary
            doc.fontSize(16).text('Summary', { underline: true });
            doc.fontSize(12).text(`Total Income: ₹ ${totalIncome.toLocaleString()}`);
            doc.text(`Total Expense: ₹ ${totalSpent.toLocaleString()}`);
            doc.text(`Total Savings: ₹ ${totalSavings.toLocaleString()}`);
            doc.font('Helvetica-Bold').fontSize(14).text(`Net Balance: ₹ ${totalBalance.toLocaleString()}`);
            doc.font('Helvetica');
            doc.moveDown();

            // Table Header
            doc.fontSize(16).text('Breakdown by Category', { underline: true });
            doc.moveDown(0.5);
            const tableTop = doc.y;
            doc.fontSize(10).font('Helvetica-Bold');
            doc.text('Category', 50, tableTop);
            doc.text('Type', 200, tableTop);
            doc.text('Target', 280, tableTop);
            doc.text('Actual', 360, tableTop);
            doc.text('% Used', 440, tableTop);
            doc.moveDown(0.5);
            doc.font('Helvetica');

            // Table Rows
            responseItems.forEach(item => {
                const percentage = item.targetAmount > 0 ? (item.amount / item.targetAmount) * 100 : 0;
                const rowY = doc.y;
                doc.text(item.categoryName, 50, rowY);
                doc.text(item.expenseType, 200, rowY);
                doc.text(`₹${item.targetAmount.toLocaleString()}`, 280, rowY);
                doc.text(`₹${item.amount.toLocaleString()}`, 360, rowY);
                doc.text(`${percentage.toFixed(1)}%`, 440, rowY);
                doc.moveDown(0.5);
            });

            doc.end();
        } catch (error) {
            console.error('Error generating PDF report:', error);
            res.status(500).json({ status: 500, success: false, message: 'Error generating PDF report' });
        }
    }
}
