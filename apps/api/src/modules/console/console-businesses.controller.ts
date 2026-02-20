import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard, Roles } from '../../common/roles.guard';
import { ConsoleBusinessesService } from './console-businesses.service';
import { PlatformAuditService } from './platform-audit.service';
import { CurrentUser } from '../../common/decorators';
import { ConsoleBusinessQueryDto } from '../../common/dto';

@ApiTags('Console - Businesses')
@Controller('admin/businesses')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('SUPER_ADMIN')
export class ConsoleBusinessesController {
  constructor(
    private businessesService: ConsoleBusinessesService,
    private auditService: PlatformAuditService,
  ) {}

  @Get()
  async list(
    @Query() query: ConsoleBusinessQueryDto,
    @CurrentUser() user: { sub: string; email: string },
  ) {
    const result = await this.businessesService.findAll(query);

    this.auditService.log(user.sub, user.email, 'BUSINESS_LIST', {
      metadata: { search: query.search, filters: { plan: query.plan, health: query.health } },
    });

    return result;
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: { sub: string; email: string }) {
    const result = await this.businessesService.findById(id);

    this.auditService.log(user.sub, user.email, 'BUSINESS_LOOKUP', {
      targetType: 'BUSINESS',
      targetId: id,
    });

    return result;
  }

  @Get(':id/staff')
  async getStaff(@Param('id') id: string, @CurrentUser() user: { sub: string; email: string }) {
    const result = await this.businessesService.getStaff(id);

    this.auditService.log(user.sub, user.email, 'BUSINESS_STAFF_LOOKUP', {
      targetType: 'BUSINESS',
      targetId: id,
    });

    return result;
  }

  @Get(':id/usage')
  async getUsage(@Param('id') id: string, @CurrentUser() user: { sub: string; email: string }) {
    const result = await this.businessesService.getUsageSnapshot(id);

    this.auditService.log(user.sub, user.email, 'BUSINESS_USAGE_LOOKUP', {
      targetType: 'BUSINESS',
      targetId: id,
    });

    return result;
  }
}
