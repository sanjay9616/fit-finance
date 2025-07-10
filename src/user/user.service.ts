import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './user.schema';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { MailService } from 'services/mail.service';
import { Response } from 'express';
import { UserDto } from 'config/interfaces';

@Injectable()
export class UsersService {
    constructor(
        @InjectModel(User.name) private userModel: Model<User>,
        private mailService: MailService,
    ) { }

    async createUser(userDto: UserDto, res: Response): Promise<Response> {
        try {
            const hashedPassword = await bcrypt.hash(userDto.password, 10);
            const verificationToken = crypto.randomBytes(32).toString('hex');
            const lastUser = await this.userModel.findOne().sort({ userId: -1 }).limit(1);
            const id = lastUser?.id ? lastUser.id + 1 : 1000;

            const newUser = new this.userModel({
                ...userDto,
                password: hashedPassword,
                verificationToken,
                verified: false,
                id
            });

            await newUser.save();
            await this.mailService.sendVerificationEmail(userDto.email, verificationToken);

            return res.status(200).json({ message: 'User created. Verification email sent.' });
        } catch (error) {
            console.error('Error during user creation:', error.message || error);
            return res.status(500).json({ message: 'Failed to create user or send email.' });
        }
    }

    async verifyUser(token: string, email: string, password: string, res: Response): Promise<Response> {
        const user = await this.userModel.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User does not exist' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        if (user.verificationToken !== token) {
            return res.status(400).json({ message: 'Invalid or expired token' });
        }

        user.verified = true;
        user.verificationToken = null;
        await user.save();

        return res.status(200).json({ message: 'User verified successfully' });
    }

    async loginUser(email: string, password: string, res: Response): Promise<Response> {

        try {
            const user = await this.userModel.findOne({ email }).select('+password'); // ensure password is selected

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                return res.status(400).json({ message: 'Invalid email or password' });
            }

            if (!user.verified) {
                return res.status(403).json({ message: 'User not verified' });
            }

            // 🔐 Generate a secure login token
            const loginToken = crypto.randomBytes(32).toString('hex');
            const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

            // Save token in the user document
            user.token = loginToken;
            user.tokenExpiresAt = tokenExpiresAt.getTime();
            await user.save();

            // Exclude password from returned user data
            const userDetails = user.toObject() as any;
            delete userDetails.password;
            delete userDetails.verificationToken;

            return res.status(200).json({ status: 200, success: true, message: 'Login successful', user: userDetails });
        } catch (error) {
            console.error('Error during login:', error.message || error);
            return res.status(500).json({ message: 'Login failed' });
        }
    }


    async validateToken(token: string, res: Response): Promise<Response> {
        try {
            if (!token) {
                return res.status(400).json({ message: 'Token is required' });
            }

            const user = await this.userModel.findOne({ token });

            if (!user) {
                return res.status(401).json({ message: 'Invalid token' });
            }

            const now = Date.now();
            const tokenExpiry = user.tokenExpiresAt;

            if (!tokenExpiry || now > tokenExpiry) {
                return res.status(401).json({ message: 'Token expired' });
            }

            const userDetails = user.toObject() as any;
            delete userDetails.password;
            delete userDetails.verificationToken;
            delete userDetails.token;

            return res.status(200).json({ status: 200, success: true, message: "Validated successful", user: userDetails });
        } catch (error) {
            console.error('Token validation error:', error.message || error);
            return res.status(500).json({ message: 'Token validation failed' });
        }
    }


}
