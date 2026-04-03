import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, Roles, AllowAnyRole } from '../../common/roles.guard';
import { BusinessId, CurrentUser } from '../../common/decorators';
import { RefundsService } from './refunds.service';
import { CreateRefundDto, ListRefundsDto } from './dto';

@Controller('refunds')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
@AllowAnyRole()
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  @Post()
  @Roles('OWNER', 'ADMIN')
  create(
    @BusinessId() businessId: string,
    @Body() body: CreateRefundDto,
    @CurrentUser() user: any,
  ) {
    return this.refundsService.create(businessId, body, user.id);
  }

  @Get()
  findAll(@BusinessId() businessId: string, @Query() query: ListRefundsDto) {
    return this.refundsService.findAll(businessId, query);
  }

  @Get(':id')
  findOne(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.refundsService.findOne(businessId, id);
  }
}
