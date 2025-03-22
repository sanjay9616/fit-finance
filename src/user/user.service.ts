import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './user.schema';
import { UserDto } from './user.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { MailService } from 'services/mail.service';

@Injectable()
export class UsersService {
    constructor(
        @InjectModel(User.name) private userModel: Model<User>,
        private mailService: MailService,
    ) { }

    async createUser(userDto: UserDto): Promise<string> {
        try {
            const hashedPassword = await bcrypt.hash(userDto.password, 10);
            const verificationToken = crypto.randomBytes(32).toString('hex');

            const newUser = new this.userModel({
                ...userDto,
                password: hashedPassword,
                verificationToken,
                verified: false,
            });

            await newUser.save();
            console.log('User created:', newUser);

            await this.mailService.sendVerificationEmail(userDto.email, verificationToken);
            console.log('Verification email sent to:', userDto.email);

            return 'User created. Verification email sent.';
        } catch (error) {
            console.error('Error during user creation:', error.message || error);
            throw new Error('Failed to create user or send email.');
        }
    }


    async verifyUser(token: string): Promise<string> {
        const user = await this.userModel.findOne({ verificationToken: token });

        if (!user) {
            throw new NotFoundException('Invalid or expired token');
        }

        user.verified = true;
        user.verificationToken = null;
        await user.save();

        return 'User verified successfully';
    }
}
