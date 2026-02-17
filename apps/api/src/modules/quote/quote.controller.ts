import { Controller, Get, Post, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { QuoteService } from './quote.service';
import { BusinessId } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard } from '../../common/roles.guard';
import { CreateQuoteDto } from '../../common/dto';

@ApiTags('Quotes')
@Controller('quotes')
export class QuoteController {
  constructor(private quoteService: QuoteService) {}

  // Authenticated endpoints
  @Post()
  @UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  create(@BusinessId() businessId: string, @Body() body: CreateQuoteDto) {
    return this.quoteService.create(businessId, body);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
  findById(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.quoteService.findById(businessId, id);
  }

  @Get('booking/:bookingId')
  @UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
  findByBooking(@BusinessId() businessId: string, @Param('bookingId') bookingId: string) {
    return this.quoteService.findByBooking(businessId, bookingId);
  }
}
