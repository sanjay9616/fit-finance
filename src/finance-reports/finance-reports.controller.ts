import { Controller, Post, Body, Res, Param } from '@nestjs/common';
import { FinanceReportsService } from './finance-reports.service';
import { Response } from 'express';

@Controller('finance-reports')
export class FinanceReportsController {
    constructor(private readonly financeReportsService: FinanceReportsService) { }

    @Post(':userId/download')
    async downloadFinanceReportPdf(
        @Res() res: Response,
        @Param('userId') userId: string | number,
        @Body('from') from: number,
        @Body('to') to: number
    ): Promise<void> {
        await this.financeReportsService.downloadFinanceReportPdf(res, { userId: Number(userId), from: Number(from), to: Number(to) });
    }

    @Post(':userId')
    async getFinanceReport(
        @Res() res: Response,
        @Param('userId') userId: string | number,
        @Body('from') from: number,
        @Body('to') to: number
    ): Promise<void> {
        await this.financeReportsService.getFinanceReport(res, { userId: Number(userId), from: Number(from), to: Number(to) });
    }
}
