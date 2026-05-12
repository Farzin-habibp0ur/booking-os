import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard, Roles, AllowAnyRole } from '../../common/roles.guard';
import { ConsoleBusinessesService } from './console-businesses.service';
import { PlatformAuditService } from './platform-audit.service';
import { CurrentUser } from '../../common/decorators';
import { ConsoleBusinessQueryDto } from '../../common/dto';

@ApiTags('Console - Businesses')
@Controller('admin/businesses')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@AllowAnyRole()
@Roles('SUPER_ADMIN')
@Throttle({ default: { ttl: 60000, limit: 10 } })
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

  @Get(':id/baseline')
  async getBaseline(@Param('id') id: string, @CurrentUser() user: { sub: string; email: string }) {
    const result = await this.businessesService.getBaseline(id);
    this.auditService.log(user.sub, user.email, 'BUSINESS_BASELINE_LOOKUP', {
      targetType: 'BUSINESS',
      targetId: id,
    });
    return result;
  }

  @Patch(':id/baseline')
  async updateBaseline(
    @Param('id') id: string,
    @Body()
    body: {
      monthlyBookings?: number | null;
      monthlyRevenue?: number | string | null;
      capturedAt?: string | null;
      notes?: string | null;
    },
    @CurrentUser() user: { sub: string; email: string },
  ) {
    const result = await this.businessesService.updateBaseline(id, body);
    this.auditService.log(user.sub, user.email, 'BUSINESS_BASELINE_UPDATE', {
      targetType: 'BUSINESS',
      targetId: id,
      metadata: {
        monthlyBookings: body.monthlyBookings ?? null,
        monthlyRevenue: body.monthlyRevenue ?? null,
      },
    });
    return result;
  }

  @Get(':id/pilot-health')
  async getPilotHealth(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string; email: string },
  ) {
    const result = await this.businessesService.getPilotHealth(id);
    this.auditService.log(user.sub, user.email, 'BUSINESS_PILOT_HEALTH_LOOKUP', {
      targetType: 'BUSINESS',
      targetId: id,
    });
    return result;
  }
}
