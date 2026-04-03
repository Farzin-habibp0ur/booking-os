import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { BusinessService } from './business.service';
import { BusinessId } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, Roles, AllowAnyRole } from '../../common/roles.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { UpdateBusinessDto, UpdatePolicySettingsDto, UpdateBrandingDto } from '../../common/dto';

@ApiTags('Business')
@Controller('business')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
@AllowAnyRole()
export class BusinessController {
  constructor(private businessService: BusinessService) {}

  @Get()
  get(@BusinessId() businessId: string) {
    return this.businessService.findById(businessId);
  }

  @Patch()
  @Roles('ADMIN')
  update(@BusinessId() businessId: string, @Body() body: UpdateBusinessDto) {
    return this.businessService.update(businessId, body);
  }

  @Get('notification-settings')
  async getNotificationSettings(@BusinessId() businessId: string) {
    return this.businessService.getNotificationSettings(businessId);
  }

  @Patch('notification-settings')
  @Roles('ADMIN')
  async updateNotificationSettings(
    @BusinessId() businessId: string,
    @Body() body: { channels?: string; followUpDelayHours?: number },
  ) {
    return this.businessService.updateNotificationSettings(businessId, body);
  }

  @Get('policy-settings')
  async getPolicySettings(@BusinessId() businessId: string) {
    return this.businessService.getPolicySettings(businessId);
  }

  @Patch('policy-settings')
  @Roles('ADMIN')
  async updatePolicySettings(
    @BusinessId() businessId: string,
    @Body() body: UpdatePolicySettingsDto,
  ) {
    return this.businessService.updatePolicySettings(businessId, body);
  }

  @Get('calendar-hours')
  async getCalendarHours(@BusinessId() businessId: string) {
    return this.businessService.getCalendarHours(businessId);
  }

  @Patch('calendar-hours')
  @Roles('ADMIN')
  async updateCalendarHours(
    @BusinessId() businessId: string,
    @Body() body: { startHour?: number; endHour?: number },
  ) {
    return this.businessService.updateCalendarHours(businessId, body);
  }

  @Get('branding')
  async getBranding(@BusinessId() businessId: string) {
    return this.businessService.getBranding(businessId);
  }

  @Patch('branding')
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('logo'))
  async updateBranding(
    @BusinessId() businessId: string,
    @Body() body: UpdateBrandingDto,
    @UploadedFile() logo?: Express.Multer.File,
  ) {
    let logoKey: string | undefined;
    if (logo) {
      const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml'];
      if (!allowedTypes.includes(logo.mimetype)) {
        throw new BadRequestException('Logo must be PNG, JPG, or SVG');
      }
      if (logo.size > 2 * 1024 * 1024) {
        throw new BadRequestException('Logo must be under 2MB');
      }
      const fs = await import('fs');
      const path = await import('path');
      const crypto = await import('crypto');
      const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const ext = path.extname(logo.originalname);
      logoKey = `brand-${crypto.randomUUID()}${ext}`;
      await fs.promises.writeFile(path.join(uploadDir, logoKey), logo.buffer);
    }
    return this.businessService.updateBranding(businessId, body, logoKey);
  }

  @Post('install-pack')
  @Roles('ADMIN')
  installPack(@BusinessId() businessId: string, @Body() body: { packName: string }) {
    return this.businessService.installPack(businessId, body.packName);
  }

  @Get('waitlist-settings')
  async getWaitlistSettings(@BusinessId() businessId: string) {
    return this.businessService.getWaitlistSettings(businessId);
  }

  @Patch('waitlist-settings')
  @Roles('ADMIN')
  async updateWaitlistSettings(
    @BusinessId() businessId: string,
    @Body()
    body: { offerCount?: number; expiryMinutes?: number; quietStart?: string; quietEnd?: string },
  ) {
    return this.businessService.updateWaitlistSettings(businessId, body);
  }

  @Get('onboarding-status')
  async getOnboardingStatus(@BusinessId() businessId: string) {
    return this.businessService.getOnboardingStatus(businessId);
  }

  @Post('create-test-booking')
  @Roles('ADMIN')
  createTestBooking(@BusinessId() businessId: string) {
    return this.businessService.createTestBooking(businessId);
  }

  @Get('activation-status')
  async getActivationStatus(@BusinessId() businessId: string) {
    return this.businessService.getActivationStatus(businessId);
  }

  @Post('activation-action')
  async markActivationAction(@BusinessId() businessId: string, @Body() body: { action: string }) {
    return this.businessService.markActivationAction(businessId, body.action);
  }

  @Post('nps')
  async submitNps(
    @BusinessId() businessId: string,
    @Body() body: { score: number; feedback?: string },
  ) {
    return this.businessService.submitNps(businessId, body.score, body.feedback);
  }
}
