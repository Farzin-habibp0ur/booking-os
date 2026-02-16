import { Controller, Get, Patch, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { BusinessService } from './business.service';
import { BusinessId } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, Roles } from '../../common/roles.guard';
import { UpdateBusinessDto } from '../../common/dto';

@ApiTags('Business')
@Controller('business')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
export class BusinessController {
  constructor(private businessService: BusinessService) {}

  @Get()
  get(@BusinessId() businessId: string) {
    return this.businessService.findById(businessId);
  }

  @Patch()
  @Roles('ADMIN')
  update(@BusinessId() businessId: string, @Body() body: UpdateBusinessDto) {
    return this.businessService.update(businessId, body);
  }

  @Get('notification-settings')
  async getNotificationSettings(@BusinessId() businessId: string) {
    return this.businessService.getNotificationSettings(businessId);
  }

  @Patch('notification-settings')
  @Roles('ADMIN')
  async updateNotificationSettings(
    @BusinessId() businessId: string,
    @Body() body: { channels?: string; followUpDelayHours?: number },
  ) {
    return this.businessService.updateNotificationSettings(businessId, body);
  }

  @Post('install-pack')
  @Roles('ADMIN')
  installPack(@BusinessId() businessId: string, @Body() body: { packName: string }) {
    return this.businessService.installPack(businessId, body.packName);
  }
}
