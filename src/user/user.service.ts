import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './user.schema';
import { UserDto } from './user.dto';
import * as bcrypt from 'bcrypt'; // ✅ Import bcrypt for hashing

@Injectable()
export class UsersService {
    constructor(@InjectModel(User.name) private userModel: Model<User>) { }

    async createUser(userDto: UserDto): Promise<User> {
        const hashedPassword = await bcrypt.hash(userDto.password, 10); // ✅ Hash password
        const newUser = new this.userModel({ ...userDto, password: hashedPassword });
        return await newUser.save();
    }
}
