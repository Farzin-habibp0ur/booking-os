import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, AllowAnyRole } from '../../common/roles.guard';
import { BusinessId, CurrentUser } from '../../common/decorators';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto, ListPaymentsDto, UpdatePaymentDto } from './dto';

@Controller('payments')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
@AllowAnyRole()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  create(
    @BusinessId() businessId: string,
    @Body() body: CreatePaymentDto,
    @CurrentUser() user: any,
  ) {
    return this.paymentsService.create(businessId, body, user.id);
  }

  @Get('summary')
  summary(
    @BusinessId() businessId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.paymentsService.summary(businessId, from, to);
  }

  @Get()
  findAll(@BusinessId() businessId: string, @Query() query: ListPaymentsDto) {
    return this.paymentsService.findAll(businessId, query);
  }

  @Get(':id')
  findOne(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.paymentsService.findOne(businessId, id);
  }

  @Patch(':id')
  update(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: UpdatePaymentDto,
  ) {
    return this.paymentsService.update(businessId, id, body);
  }
}
