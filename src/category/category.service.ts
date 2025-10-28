import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { CategoryDto } from "config/interfaces";
import { Model } from "mongoose";
import { Category } from "./category.schema";
import { Response } from "express";
import { MESSAGE } from "config/message";

@Injectable()
export class CategoryService {
    constructor(@InjectModel(Category.name) private readonly categoryModel: Model<Category>) { }

    async getAllCategories(res: Response, userId: number, search?: string): Promise<Response> {
        try {
            if (!userId) {
                return res.status(400).json({ status: 400, success: false, message: MESSAGE.ERROR.INVALID_USER_ID });
            }

            const query: any = { userId };

            if (search) {
                if (!isNaN(Number(search))) {
                    query.categoryId = Number(search);
                } else {
                    query.categoryName = { $regex: search, $options: "i" };
                }
            }

            const categories = await this.categoryModel.find(query).exec();

            return res.status(200).json({ status: 200, success: true, data: categories });
        } catch (error) {
            console.error("Error fetching categories:", error.message || error);
            return res.status(500).json({ status: 500, success: false, message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` });
        }
    }

    async createCategory(categoryDto: CategoryDto, res: Response): Promise<Response> {
        try {
            const existingCategory = await this.categoryModel.findOne({
                userId: categoryDto.userId,
                categoryName: { $regex: `^${categoryDto.categoryName}$`, $options: "i" },
            }).exec();

            if (existingCategory) {
                return res.status(400).json({ status: 400, success: false, message: MESSAGE.ERROR.DUPLICATE_CATEGORY });
            }

            const lastCategory = await this.categoryModel.findOne().sort({ categoryId: -1 }).exec();
            const newCategoryId = lastCategory ? lastCategory.categoryId + 1 : 1;

            const created = new this.categoryModel({
                ...categoryDto,
                categoryId: newCategoryId,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            });

            const savedCategory = await created.save();

            return res.status(200).json({ status: 200, success: true, message: MESSAGE.ERROR.CATEGORY_CREATED, data: savedCategory });
        } catch (error) {
            console.error("Error creating category:", error.message || error);
            return res.status(500).json({ status: 500, success: false, message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` });
        }
    }

    async updateCategory(categoryId: number, categoryDto: Partial<CategoryDto>, res: Response): Promise<Response> {
        try {
            if (categoryDto.categoryName && categoryDto.userId) {
                const duplicate = await this.categoryModel.findOne({
                    userId: categoryDto.userId,
                    categoryName: categoryDto.categoryName,
                    categoryId: { $ne: categoryId }
                });

                if (duplicate) {
                    return res.status(200).json({ status: 400, success: false, message: `Category "${categoryDto.categoryName}" already exists for this user.` });
                }
            }

            const updatedCategory = await this.categoryModel.findOneAndUpdate(
                { categoryId },
                { ...categoryDto, updatedAt: Date.now() },
                { new: true }
            ).exec();

            if (!updatedCategory) {
                return res.status(404).json({ status: 404, success: false, message: MESSAGE.ERROR.CATEGORY_NOT_FOUND });
            }

            return res.status(200).json({ status: 200, success: true, message: MESSAGE.ERROR.CATEGORY_UPDATED, data: updatedCategory });
        } catch (error) {
            console.error('Error updating category:', error.message || error);
            return res.status(500).json({ status: 500, success: false, message: `Error: ${MESSAGE.ERROR.SOMETHING_WENT_WRONG}` });
        }
    }
}
