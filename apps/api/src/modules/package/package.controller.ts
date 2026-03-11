import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard } from '../../common/roles.guard';
import { BusinessId } from '../../common/decorators';
import { PackageService } from './package.service';
import { CreatePackageDto, UpdatePackageDto, PurchasePackageDto, RedeemPackageDto } from './dto';

@Controller('packages')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
export class PackageController {
  constructor(private readonly packageService: PackageService) {}

  @Post()
  create(@BusinessId() businessId: string, @Body() body: CreatePackageDto) {
    return this.packageService.create(businessId, body);
  }

  @Get()
  findAll(@BusinessId() businessId: string) {
    return this.packageService.findAll(businessId);
  }

  @Get('stats')
  stats(@BusinessId() businessId: string) {
    return this.packageService.stats(businessId);
  }

  @Get('purchases')
  listPurchases(
    @BusinessId() businessId: string,
    @Query('customerId') customerId?: string,
    @Query('status') status?: string,
  ) {
    return this.packageService.listPurchases(businessId, customerId, status);
  }

  @Get('purchases/:purchaseId')
  getPurchase(
    @BusinessId() businessId: string,
    @Param('purchaseId') purchaseId: string,
  ) {
    return this.packageService.getPurchase(businessId, purchaseId);
  }

  @Get('customer/:customerId/active')
  getCustomerActivePackages(
    @BusinessId() businessId: string,
    @Param('customerId') customerId: string,
    @Query('serviceId') serviceId?: string,
  ) {
    return this.packageService.getCustomerActivePackages(businessId, customerId, serviceId);
  }

  @Get(':id')
  findOne(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.packageService.findOne(businessId, id);
  }

  @Patch(':id')
  update(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: UpdatePackageDto,
  ) {
    return this.packageService.update(businessId, id, body);
  }

  @Delete(':id')
  delete(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.packageService.delete(businessId, id);
  }

  @Post(':id/purchase')
  purchase(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: PurchasePackageDto,
  ) {
    return this.packageService.purchase(businessId, id, body);
  }

  @Post('purchases/:purchaseId/redeem')
  redeem(
    @BusinessId() businessId: string,
    @Param('purchaseId') purchaseId: string,
    @Body() body: RedeemPackageDto,
  ) {
    return this.packageService.redeem(businessId, purchaseId, body);
  }
}
