export class UserDto {
    name: string;
    email: string;
    password: string;
}

export class CreateExpenseDto {
    category: string;
    email: string;
    amount: number;
    description?: string;
}