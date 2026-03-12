import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BusinessId } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard } from '../../common/roles.guard';
import { MedicalRecordService } from './medical-record.service';
import { CreateMedicalRecordDto } from './dto';

@Controller('medical-records')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
export class MedicalRecordController {
  constructor(private readonly medicalRecordService: MedicalRecordService) {}

  @Post()
  async create(
    @BusinessId() businessId: string,
    @Body() dto: CreateMedicalRecordDto,
    @Req() req: any,
  ) {
    return this.medicalRecordService.create(businessId, dto, req.user?.staffId);
  }

  @Get()
  async getCurrent(@BusinessId() businessId: string, @Query('customerId') customerId: string) {
    if (!customerId) {
      throw new BadRequestException('customerId query parameter is required');
    }
    return this.medicalRecordService.getCurrent(businessId, customerId);
  }

  @Get(':id/history')
  async getHistory(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.medicalRecordService.getHistory(businessId, id);
  }
}
