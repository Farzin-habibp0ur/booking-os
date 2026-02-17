import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, Roles } from '../../common/roles.guard';
import { BusinessId } from '../../common/decorators';
import { CreateOfferDto, UpdateOfferDto } from '../../common/dto';
import { OfferService } from './offer.service';

@Controller('offers')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
export class OfferController {
  constructor(private offerService: OfferService) {}

  @Post()
  @Roles('ADMIN')
  create(@BusinessId() businessId: string, @Body() body: CreateOfferDto) {
    return this.offerService.create(businessId, body);
  }

  @Get()
  findAll(@BusinessId() businessId: string) {
    return this.offerService.findAll(businessId);
  }

  @Get(':id')
  findById(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.offerService.findById(businessId, id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@BusinessId() businessId: string, @Param('id') id: string, @Body() body: UpdateOfferDto) {
    return this.offerService.update(businessId, id, body);
  }

  @Post(':id/redeem')
  redeem(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.offerService.redeem(businessId, id);
  }

  @Delete(':id')
  @Roles('ADMIN')
  delete(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.offerService.delete(businessId, id);
  }
}
