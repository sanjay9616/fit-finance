import { Controller, Post, Body, Get, Query, Res } from '@nestjs/common';
import { UsersService } from './user.service';
import { UserDto } from './user.dto';
import { Response } from 'express';

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Post('create')
    async createUser(@Body() userDto: UserDto, @Res() res: Response): Promise<void> {
        await this.usersService.createUser(userDto, res);
    }

    @Post('verify')
    async verifyUser(
        @Query('token') token: string,
        @Body() { email, password }: { email: string; password: string },
        @Res() res: Response
    ): Promise<any> {
        await this.usersService.verifyUser(token, email, password, res);
    }

    @Post('login')
    async loginUser(
        @Body() loginDto: { email: string; password: string },
        @Res() res: Response
    ): Promise<any> {
        await this.usersService.loginUser(loginDto.email, loginDto.password, res);
    }
}
