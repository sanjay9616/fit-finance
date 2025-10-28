import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SplitExpenseDocument = SplitExpense & Document;

@Schema()
export class SplitExpense {
    @Prop({ required: true })
    title: string;

    @Prop({ required: true })
    amount: number;

    @Prop({ required: true })
    paidBy: number;

    @Prop({ required: true, type: [Number] })
    splitBetween: number[];

    @Prop({ required: true, unique: true })
    splitExpenseId: number;

    @Prop({ required: true })
    splitGroupId: number;

    @Prop({ required: true })
    createdAt: number;

    @Prop({ required: true })
    updatedAt: number;
}

export const SplitExpenseSchema = SchemaFactory.createForClass(SplitExpense);
