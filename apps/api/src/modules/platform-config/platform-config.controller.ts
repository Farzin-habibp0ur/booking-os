import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, Roles } from '../../common/roles.guard';
import { BusinessId } from '../../common/decorators';
import { PlatformConfigService } from './platform-config.service';
import { UpdatePlatformConfigDto } from './dto';

@Controller('platform-config')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
export class PlatformConfigController {
  constructor(private readonly service: PlatformConfigService) {}

  @Get()
  findAll(@BusinessId() businessId: string) {
    return this.service.findAll(businessId);
  }

  @Patch(':platform')
  @Roles('OWNER', 'ADMIN')
  update(
    @BusinessId() businessId: string,
    @Param('platform') platform: string,
    @Body() dto: UpdatePlatformConfigDto,
  ) {
    return this.service.update(businessId, platform, dto);
  }

  @Get('publishing-windows')
  getPublishingWindows(@BusinessId() businessId: string) {
    return this.service.getPublishingWindows(businessId);
  }
}
