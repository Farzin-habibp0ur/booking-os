import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BusinessService } from './business.service';
import { BusinessId } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';

@Controller('business')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class BusinessController {
  constructor(private businessService: BusinessService) {}

  @Get()
  get(@BusinessId() businessId: string) {
    return this.businessService.findById(businessId);
  }

  @Patch()
  update(@BusinessId() businessId: string, @Body() body: any) {
    return this.businessService.update(businessId, body);
  }
}
