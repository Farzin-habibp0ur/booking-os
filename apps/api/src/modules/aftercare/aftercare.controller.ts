import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard } from '../../common/roles.guard';
import { BusinessId } from '../../common/decorators';
import { AftercareService } from './aftercare.service';
import { CreateProtocolDto, UpdateProtocolDto } from './dto';

@Controller('aftercare-protocols')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
export class AftercareController {
  constructor(private readonly aftercareService: AftercareService) {}

  @Post()
  createProtocol(@BusinessId() businessId: string, @Body() dto: CreateProtocolDto) {
    return this.aftercareService.createProtocol(businessId, dto);
  }

  @Get()
  findAllProtocols(@BusinessId() businessId: string) {
    return this.aftercareService.findAllProtocols(businessId);
  }

  @Get(':id')
  findProtocol(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.aftercareService.findProtocol(businessId, id);
  }

  @Patch(':id')
  updateProtocol(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProtocolDto,
  ) {
    return this.aftercareService.updateProtocol(businessId, id, dto);
  }

  @Delete(':id')
  deleteProtocol(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.aftercareService.deleteProtocol(businessId, id);
  }

  @Get('/enrollments/list')
  findEnrollments(
    @BusinessId() businessId: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.aftercareService.findEnrollments(businessId, customerId);
  }

  @Post('/enrollments/:id/cancel')
  cancelEnrollment(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.aftercareService.cancelEnrollment(businessId, id);
  }
}
