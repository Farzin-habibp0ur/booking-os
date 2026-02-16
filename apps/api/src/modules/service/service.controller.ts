import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ServiceService } from './service.service';
import { BusinessId } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';
import { CreateServiceDto, UpdateServiceDto } from '../../common/dto';

@Controller('services')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class ServiceController {
  constructor(private serviceService: ServiceService) {}

  @Get()
  list(@BusinessId() businessId: string) {
    return this.serviceService.findAll(businessId);
  }

  @Post()
  create(@BusinessId() businessId: string, @Body() body: CreateServiceDto) {
    return this.serviceService.create(businessId, body);
  }

  @Patch(':id')
  update(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: UpdateServiceDto,
  ) {
    return this.serviceService.update(businessId, id, body);
  }

  @Delete(':id')
  deactivate(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.serviceService.deactivate(businessId, id);
  }
}
