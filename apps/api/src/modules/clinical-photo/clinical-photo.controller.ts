import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  Body,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ClinicalPhotoService } from './clinical-photo.service';
import { BusinessId } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard } from '../../common/roles.guard';
import { CreateComparisonDto } from './dto';

@ApiTags('Clinical Photos')
@Controller('clinical-photos')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
export class ClinicalPhotoController {
  constructor(private readonly clinicalPhotoService: ClinicalPhotoService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @BusinessId() businessId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    if (!body.customerId || !body.type || !body.bodyArea) {
      throw new BadRequestException('customerId, type, and bodyArea are required');
    }

    return this.clinicalPhotoService.upload(
      businessId,
      {
        customerId: body.customerId,
        bookingId: body.bookingId,
        type: body.type,
        bodyArea: body.bodyArea,
        notes: body.notes,
        takenAt: body.takenAt,
      },
      {
        buffer: file.buffer,
        mimetype: file.mimetype,
        size: file.size,
        originalname: file.originalname,
      },
      req.user?.staffId,
    );
  }

  @Get()
  async list(
    @BusinessId() businessId: string,
    @Query('customerId') customerId: string,
    @Query('type') type?: string,
    @Query('bodyArea') bodyArea?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!customerId) {
      throw new BadRequestException('customerId query parameter is required');
    }
    return this.clinicalPhotoService.list(businessId, customerId, { type, bodyArea, from, to });
  }

  @Get('comparisons')
  async listComparisons(@BusinessId() businessId: string, @Query('customerId') customerId: string) {
    if (!customerId) {
      throw new BadRequestException('customerId query parameter is required');
    }
    return this.clinicalPhotoService.listComparisons(businessId, customerId);
  }

  @Get('file/:key')
  async serveFile(
    @BusinessId() businessId: string,
    @Param('key') key: string,
    @Res() res: Response,
  ) {
    const sanitizedKey = key.replace(/[^a-zA-Z0-9._-]/g, '');
    const filePath = this.clinicalPhotoService.getFilePath(sanitizedKey);
    res.sendFile(filePath);
  }

  @Get(':id')
  async findById(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.clinicalPhotoService.findById(businessId, id);
  }

  @Delete(':id')
  async delete(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.clinicalPhotoService.softDelete(businessId, id);
  }

  @Post('compare')
  async createComparison(@BusinessId() businessId: string, @Body() dto: CreateComparisonDto) {
    return this.clinicalPhotoService.createComparison(businessId, dto);
  }
}
