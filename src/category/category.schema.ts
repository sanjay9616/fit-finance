import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } })
export class Category {
    @Prop({ required: true })
    userId: number;

    @Prop({ required: true, unique: true })
    categoryId: number;

    @Prop({ required: true })
    categoryName: string;

    @Prop()
    createdAt: number;

    @Prop()
    updatedAt: number;
}

export type CategoryDocument = Category & Document;

export const CategorySchema = SchemaFactory.createForClass(Category);
