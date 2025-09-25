import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ExpenseGoalDocument = ExpenseGoal & Document;

@Schema()
export class ExpenseGoal {
    @Prop({ required: true })
    userId: number;

    @Prop({ required: true })
    categoryId: number;

    @Prop({ required: true })
    expenseType: string;

    @Prop({ required: true })
    targetAmount: number;

    @Prop({ required: true, default: 0 })
    currentAmount: number;

    @Prop()
    description: string;

    @Prop({ default: Date.now })
    createdAt: number;

    @Prop({ default: Date.now })
    updatedAt: number;
}


export const ExpenseGoalSchema = SchemaFactory.createForClass(ExpenseGoal);
