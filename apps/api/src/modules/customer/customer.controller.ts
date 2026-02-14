import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CustomerService } from './customer.service';
import { BusinessId } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';

@Controller('customers')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class CustomerController {
  constructor(private customerService: CustomerService) {}

  @Get()
  list(@BusinessId() businessId: string, @Query() query: { search?: string; page?: string; pageSize?: string }) {
    return this.customerService.findAll(businessId, {
      search: query.search,
      page: query.page ? parseInt(query.page) : undefined,
      pageSize: query.pageSize ? parseInt(query.pageSize) : undefined,
    });
  }

  @Get(':id')
  detail(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.customerService.findById(businessId, id);
  }

  @Post()
  create(@BusinessId() businessId: string, @Body() body: any) {
    return this.customerService.create(businessId, body);
  }

  @Patch(':id')
  update(@BusinessId() businessId: string, @Param('id') id: string, @Body() body: any) {
    return this.customerService.update(businessId, id, body);
  }

  @Get(':id/bookings')
  bookings(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.customerService.getBookings(businessId, id);
  }
}
