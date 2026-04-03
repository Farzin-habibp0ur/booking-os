import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, AllowAnyRole } from '../../common/roles.guard';
import { BusinessId, CurrentUser } from '../../common/decorators';
import { InvoiceService } from './invoice.service';
import { CreateInvoiceDto, UpdateInvoiceDto, ListInvoicesDto, RecordPaymentDto } from './dto';

@Controller('invoices')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
@AllowAnyRole()
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Post()
  create(@BusinessId() businessId: string, @Body() body: CreateInvoiceDto) {
    return this.invoiceService.create(businessId, body);
  }

  @Post('from-booking/:bookingId')
  createFromBooking(@BusinessId() businessId: string, @Param('bookingId') bookingId: string) {
    return this.invoiceService.createFromBooking(businessId, bookingId);
  }

  @Post('from-quote/:quoteId')
  createFromQuote(@BusinessId() businessId: string, @Param('quoteId') quoteId: string) {
    return this.invoiceService.createFromQuote(businessId, quoteId);
  }

  @Get('stats')
  stats(@BusinessId() businessId: string) {
    return this.invoiceService.stats(businessId);
  }

  @Get()
  findAll(@BusinessId() businessId: string, @Query() query: ListInvoicesDto) {
    return this.invoiceService.findAll(businessId, query);
  }

  @Get(':id')
  findOne(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.invoiceService.findOne(businessId, id);
  }

  @Patch(':id')
  update(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: UpdateInvoiceDto,
  ) {
    return this.invoiceService.update(businessId, id, body);
  }

  @Post(':id/send')
  send(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.invoiceService.send(businessId, id);
  }

  @Post(':id/cancel')
  cancel(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.invoiceService.cancel(businessId, id);
  }

  @Post(':id/record-payment')
  recordPayment(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: RecordPaymentDto,
    @CurrentUser() user: any,
  ) {
    return this.invoiceService.recordPayment(businessId, id, body, user.id);
  }
}
