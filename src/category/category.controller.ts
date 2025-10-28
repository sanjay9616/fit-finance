import { Controller, Post, Body, Get, Param, Query, Res } from "@nestjs/common";
import { CategoryDto } from "config/interfaces";
import { Category } from "./category.schema";
import { CategoryService } from "./category.service";
import { Response } from "express";

@Controller('category')
export class CategoryController {
    constructor(private readonly categoryService: CategoryService) { }

    @Get('all')
    async getAllCategories(@Res() res: Response, @Query('userId') userId: string, @Query('search') search?: string) {
        return this.categoryService.getAllCategories(res, Number(userId), search);
    }

    @Post('create')
    async createCategory(@Body() categoryDto: CategoryDto, @Res() res: Response) {
        return this.categoryService.createCategory(categoryDto, res);
    }

    @Post('update/:categoryId')
    async updateCategory(@Param('categoryId') categoryId: number, @Body() categoryDto: Partial<CategoryDto>, @Res() res: Response) {
        return this.categoryService.updateCategory(categoryId, categoryDto, res);
    }

}
