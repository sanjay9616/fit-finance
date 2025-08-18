export class UserDto {
    name: string;
    email: string;
    password: string;
}

export class CreateExpenseDto {
    name: string;
    category: string;
    expenseType: 'Expense' | 'Income' | 'Saving';
    amount: number;
    description?: string;
    userId: number;
}

export class CreateExpenseGoalDto {
    userId: number;
    category: string;
    expenseType: 'Expense' | 'Income' | 'Saving';
    targetAmount: number;
    currentAmount: number;
    description?: string;
}

