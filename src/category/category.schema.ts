import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } })
export class Category extends Document {
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

export const CategorySchema = SchemaFactory.createForClass(Category);
