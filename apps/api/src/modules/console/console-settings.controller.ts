import { Controller, Get, Put, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard, Roles } from '../../common/roles.guard';
import { ConsoleSettingsService } from './console-settings.service';
import { PlatformAuditService } from './platform-audit.service';
import { CurrentUser } from '../../common/decorators';
import { ConsoleSettingUpdateDto, ConsoleSettingsBulkUpdateDto } from '../../common/dto';

@ApiTags('Console - Settings')
@Controller('admin/settings')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('SUPER_ADMIN')
export class ConsoleSettingsController {
  constructor(
    private settingsService: ConsoleSettingsService,
    private auditService: PlatformAuditService,
  ) {}

  @Get()
  async getAllSettings(
    @CurrentUser() user: { sub: string; email: string },
  ) {
    const result = await this.settingsService.getAllSettings();

    this.auditService.log(user.sub, user.email, 'SETTINGS_VIEW');

    return result;
  }

  @Get(':key')
  async getSetting(
    @Param('key') key: string,
    @CurrentUser() user: { sub: string; email: string },
  ) {
    return this.settingsService.getSetting(key);
  }

  @Put('bulk')
  async bulkUpdate(
    @Body() dto: ConsoleSettingsBulkUpdateDto,
    @CurrentUser() user: { sub: string; email: string },
  ) {
    const result = await this.settingsService.bulkUpdate(dto.settings, user.sub);

    this.auditService.log(user.sub, user.email, 'SETTINGS_BULK_UPDATE', {
      metadata: { keys: dto.settings.map((s) => s.key) },
    });

    return result;
  }

  @Put(':key')
  async updateSetting(
    @Param('key') key: string,
    @Body() dto: ConsoleSettingUpdateDto,
    @CurrentUser() user: { sub: string; email: string },
  ) {
    const result = await this.settingsService.updateSetting(key, dto.value, user.sub);

    this.auditService.log(user.sub, user.email, 'SETTING_UPDATE', {
      targetType: 'SETTING',
      targetId: key,
      metadata: { value: dto.value },
    });

    return result;
  }

  @Post('reset/:key')
  async resetSetting(
    @Param('key') key: string,
    @CurrentUser() user: { sub: string; email: string },
  ) {
    const result = await this.settingsService.resetSetting(key, user.sub);

    this.auditService.log(user.sub, user.email, 'SETTING_RESET', {
      targetType: 'SETTING',
      targetId: key,
    });

    return result;
  }
}
