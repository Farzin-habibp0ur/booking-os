import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, Roles } from '../../common/roles.guard';
import { BusinessId } from '../../common/decorators';
import { BudgetTrackerService } from './budget-tracker.service';
import { CreateBudgetEntryDto, QueryBudgetEntriesDto } from './dto';

@Controller('budget')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class BudgetTrackerController {
  constructor(private readonly service: BudgetTrackerService) {}

  @Post()
  create(@BusinessId() businessId: string, @Body() dto: CreateBudgetEntryDto) {
    return this.service.create(businessId, dto);
  }

  @Get()
  findAll(@BusinessId() businessId: string, @Query() query: QueryBudgetEntriesDto) {
    return this.service.findAll(businessId, query);
  }

  @Get('summary')
  getSummary(
    @BusinessId() businessId: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.service.getSummary(
      businessId,
      month ? parseInt(month, 10) : undefined,
      year ? parseInt(year, 10) : undefined,
    );
  }

  @Get('roi')
  getRoi(@BusinessId() businessId: string) {
    return this.service.getRoi(businessId);
  }

  @Patch(':id/approve')
  approve(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body('approverRole') approverRole: string,
  ) {
    return this.service.approve(businessId, id, approverRole ?? 'FOUNDER');
  }
}
