export type ExpenseType = 'Expense' | 'Income' | 'Saving';

export class UserDto {
    name: string;
    email: string;
    password: string;
}

export class CreateExpenseDto {
    _id?: string
    userId: number;
    name: string;
    categoryId: number;
    expenseType: ExpenseType;
    amount: number;
    createdAt: number;
    updatedAt: number;
    description?: string;
}

export class CreateExpenseGoalDto {
    _id?: string;
    userId: number;
    categoryId?: number;
    categoryName: string;
    expenseType: ExpenseType;
    targetAmount: number;
    createdAt: number;
    updatedAt: number;
    description?: string;
}

export class SplitGroupDto {
    splitGroupId?: number;
    name: string;
    members: number[];
    createdAt?: number;
    updatedAt?: number;
}

export interface SplitExpenseDto {
    _id?: string;
    splitExpenseId?: number;
    title: string;
    amount: number;
    paidBy: number;
    splitBetween: number[];
    splitGroupId: number;
    createdAt?: number;
    updatedAt?: number;
    updatedBy?: number;
    __v?: number;
}

export interface SettleDataDto {
    splitExpenseId?: number;
    splitGroupId: number;
    from: number;
    to: number;
    amount: number;
    createdAt?: number;
    updatedAt?: number;
    updatedBy?: number;
}


export class CategoryDto {
    userId: number;
    categoryId: number;
    categoryName: string;
}