import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SplitGroupDocument = SplitGroup & Document;

@Schema()
export class SplitGroup extends Document {
    @Prop({ required: true, unique: true })
    splitGroupId: number;

    @Prop({ required: true })
    name: string;

    @Prop({ type: [Number], required: true })
    members: number[];

    @Prop({ type: Number, required: true })
    createdAt: number;

    @Prop({ type: Number, required: true })
    updatedAt: number;
}

export const SplitGroupSchema = SchemaFactory.createForClass(SplitGroup);
