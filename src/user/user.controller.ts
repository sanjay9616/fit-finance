import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { UsersService } from './user.service';
import { UserDto } from './user.dto';

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Post('create')
    async createUser(@Body() userDto: UserDto) {
        return this.usersService.createUser(userDto);
    }

    @Get('verify')
    async verifyUser(@Query('token') token: string) {
        return this.usersService.verifyUser(token);
    }
}
