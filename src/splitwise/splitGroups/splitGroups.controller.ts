import { Controller, Post, Body, Res, Get, Put, Param, Req, Query } from '@nestjs/common';
import { SplitGroupsService } from './splitGroups.service';
import { Response } from 'express';

@Controller('split-groups')
export class SplitGroupsController {
    constructor(private readonly splitGroupsService: SplitGroupsService) { }

    @Post('create')
    async createGroup(@Body() groupDto: any, @Res() res: Response): Promise<void> {
        await this.splitGroupsService.createGroup(groupDto, res);
    }

    @Get('all')
    async getAllGroups(@Query('userId') userId: number, @Res() res: Response): Promise<void> {
        await this.splitGroupsService.getAllGroups(Number(userId), res);
    }


    @Put('update/:id')
    async updateGroup(@Param('id') splitGroupId: number, @Body() groupDto: any, @Res() res: Response): Promise<void> {
        await this.splitGroupsService.updateGroup(splitGroupId, groupDto, res);
    }
}
