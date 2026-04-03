import { Controller, Get, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard, Roles, AllowAnyRole } from '../../common/roles.guard';
import { ConsoleHealthService } from './console-health.service';

@ApiTags('Console - Health')
@Controller('admin/health')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@AllowAnyRole()
@Roles('SUPER_ADMIN')
@Throttle({ default: { ttl: 60000, limit: 10 } })
export class ConsoleHealthController {
  constructor(private healthService: ConsoleHealthService) {}

  @Get()
  async getHealth() {
    return this.healthService.getHealth();
  }
}
