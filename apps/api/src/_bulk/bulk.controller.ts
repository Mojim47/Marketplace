import type { BulkService } from '@libs/bulk';
import {
  Body,
  Controller,
  Get,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
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
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename=bulk-order-template.xlsx');
    res.send(buffer);
  }

  @Post('approve-proformas')
  async approveProformas(@Body() dto: { ids: string[] }, @CurrentUser() user: AuthenticatedUser) {
    return this.bulk.bulkApproveProformas(dto.ids, user.id);
  }
}
