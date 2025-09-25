export class UserDto {
    name: string;
    email: string;
    password: string;
}

export class CreateExpenseDto {
    name: string;
    categoryId: number;
    expenseType: 'Expense' | 'Income' | 'Saving';
    amount: number;
    description?: string;
    userId: number;
}

export class CreateExpenseGoalDto {
    _id?: string
    userId: number;
    categoryId?: number;
    categoryName: string;
    expenseType: 'Expense' | 'Income' | 'Saving';
    targetAmount: number;
    currentAmount: number;
    createdAt: number;
    updatedAt: number;
    description?: string;
}

export class CategoryDto {
    userId: number;
    categoryId: number;
    categoryName: string;
}