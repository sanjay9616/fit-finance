import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SplitActivityDocument = SplitActivity & Document;

@Schema()
export class SplitActivity {
    @Prop({ required: true, unique: true })
    auditId: number;

    @Prop({ required: true })
    splitGroupId: number;

    @Prop({ required: true })
    userId: number;

    @Prop({ required: true, enum: ['CREATE_EXPENSE', 'UPDATE_EXPENSE', 'DELETE_EXPENSE', 'CREATE_SETTLE_UP', 'UPDATE_SETTLE_UP', 'DELETE_SETTLE_UP'] })
    action: string;

    @Prop({ required: true })
    title: string;   // ✅ new field

    @Prop({ required: true, type: [String] })
    description: string[];  // ✅ convert to array of strings

    @Prop({ required: true })
    timestamp: number;
}

export const SplitActivitySchema = SchemaFactory.createForClass(SplitActivity);
