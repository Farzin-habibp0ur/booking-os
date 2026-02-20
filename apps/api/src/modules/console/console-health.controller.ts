import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard, Roles } from '../../common/roles.guard';
import { ConsoleHealthService } from './console-health.service';

@ApiTags('Console - Health')
@Controller('admin/health')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('SUPER_ADMIN')
export class ConsoleHealthController {
  constructor(private healthService: ConsoleHealthService) {}

  @Get()
  async getHealth() {
    return this.healthService.getHealth();
  }
}
