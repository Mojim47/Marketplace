import { Controller, Post, UseInterceptors, UploadedFile, UseGuards, Get, Res, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BulkService } from '@libs/bulk';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { Response } from 'express';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Controller('bulk')
@UseGuards(JwtAuthGuard)
export class BulkController {
  constructor(private bulk: BulkService) {}

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async import(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: AuthenticatedUser) {
    return this.bulk.importFromExcel(file.buffer, user.id);
  }

  @Get('template')
  async template(@Res() res: Response) {
    const buffer = this.bulk.generateExcelTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=bulk-order-template.xlsx');
    res.send(buffer);
  }

  @Post('approve-proformas')
  async approveProformas(@Body() dto: { ids: string[] }, @CurrentUser() user: AuthenticatedUser) {
    return this.bulk.bulkApproveProformas(dto.ids, user.id);
  }
}

