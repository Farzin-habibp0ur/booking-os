import { Controller, Get, Post, Delete, Query, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, Roles } from '../../common/roles.guard';
import { BusinessId } from '../../common/decorators';
import { TranslationService } from './translation.service';

@Controller('translations')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
export class TranslationController {
  constructor(private translationService: TranslationService) {}

  @Get()
  getOverrides(
    @BusinessId() businessId: string,
    @Query('locale') locale: string,
  ) {
    return this.translationService.getOverrides(businessId, locale || 'en');
  }

  @Get('keys')
  getAllKeys(
    @BusinessId() businessId: string,
    @Query('locale') locale: string,
  ) {
    return this.translationService.getAllKeys(businessId, locale || 'en');
  }

  @Post()
  @Roles('OWNER', 'ADMIN')
  upsert(
    @BusinessId() businessId: string,
    @Body() body: { locale: string; key: string; value: string },
  ) {
    return this.translationService.upsert(businessId, body.locale, body.key, body.value);
  }

  @Delete(':locale/:key')
  @Roles('OWNER', 'ADMIN')
  remove(
    @BusinessId() businessId: string,
    @Param('locale') locale: string,
    @Param('key') key: string,
  ) {
    return this.translationService.remove(businessId, locale, key);
  }
}
