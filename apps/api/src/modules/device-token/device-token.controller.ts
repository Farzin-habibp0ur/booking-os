import { Controller, Post, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { DeviceTokenService } from './device-token.service';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { TenantGuard } from '../../common/tenant.guard';
import { BusinessId } from '../../common/decorators';

@Throttle({ default: { limit: 10, ttl: 60000 } })
@UseGuards(AuthGuard('jwt'), TenantGuard)
@Controller('device-tokens')
export class DeviceTokenController {
  constructor(private readonly deviceTokenService: DeviceTokenService) {}

  @Post()
  async register(
    @Body() dto: RegisterDeviceTokenDto,
    @Req() req: any,
    @BusinessId() businessId: string,
  ) {
    const staffId = req.user.staffId || req.user.sub;
    const token = await this.deviceTokenService.register(
      staffId,
      businessId,
      dto.token,
      dto.platform,
    );
    return { id: token.id, registered: true };
  }

  @Delete(':token')
  async unregister(@Param('token') token: string) {
    await this.deviceTokenService.unregister(token);
    return { deactivated: true };
  }
}
