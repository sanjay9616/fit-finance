import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ExpenseDocument = Expense & Document;

@Schema()
export class Expense {

    @Prop({ required: true })
    userId: number;

    @Prop({ required: true })
    categoryId: number;

    @Prop({ required: true })
    name: string;

    @Prop({ required: true })
    expenseType: string;

    @Prop({ required: true })
    amount: number;

    @Prop()
    description: string;

    @Prop({ default: Date.now })
    createdAt: number;

    @Prop({ default: Date.now })
    updatedAt: number;
}

export const ExpenseSchema = SchemaFactory.createForClass(Expense);
