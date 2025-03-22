import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class User extends Document {
    @Prop({ required: true })
    name: string;

    @Prop({ required: true, unique: true })
    email: string;

    @Prop({ required: true })
    password: string;

    @Prop({ default: false })
    verified: boolean;

    @Prop({ type: String, default: null })
    verificationToken?: string | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
