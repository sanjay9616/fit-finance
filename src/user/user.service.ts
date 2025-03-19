import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './user.schema';
import { UserDto } from './user.dto';

@Injectable()
export class UsersService {
    constructor(@InjectModel(User.name) private userModel: Model<User>) { }

    async createUser(userDto: UserDto): Promise<User> {
        return await new this.userModel(userDto).save();
    }
}
