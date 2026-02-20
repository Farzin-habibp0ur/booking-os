import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard, Roles } from '../../common/roles.guard';
import { ConsoleOverviewService } from './console-overview.service';

@ApiTags('Console - Overview')
@Controller('admin/overview')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('SUPER_ADMIN')
export class ConsoleOverviewController {
  constructor(private overviewService: ConsoleOverviewService) {}

  @Get()
  async getOverview() {
    return this.overviewService.getOverview();
  }
}
