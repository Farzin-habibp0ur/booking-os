import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard, Roles } from '../../common/roles.guard';
import { ConsoleMessagingService } from './console-messaging.service';
import { PlatformAuditService } from './platform-audit.service';
import { CurrentUser } from '../../common/decorators';

@ApiTags('Console - Messaging')
@Controller('admin/messaging-console')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('SUPER_ADMIN')
export class ConsoleMessagingController {
  constructor(
    private messagingService: ConsoleMessagingService,
    private auditService: PlatformAuditService,
  ) {}

  @Get('dashboard')
  async getDashboard(@CurrentUser() user: { sub: string; email: string }) {
    const result = await this.messagingService.getDashboard();

    this.auditService.log(user.sub, user.email, 'MESSAGING_DASHBOARD_VIEW');

    return result;
  }

  @Get('failures')
  async getFailures(@CurrentUser() user: { sub: string; email: string }) {
    const result = await this.messagingService.getFailures();

    this.auditService.log(user.sub, user.email, 'MESSAGING_FAILURES_VIEW');

    return result;
  }

  @Get('webhook-health')
  async getWebhookHealth(@CurrentUser() user: { sub: string; email: string }) {
    const result = await this.messagingService.getWebhookHealth();

    this.auditService.log(user.sub, user.email, 'MESSAGING_WEBHOOK_HEALTH_VIEW');

    return result;
  }

  @Get('tenant-status')
  async getTenantStatus(@CurrentUser() user: { sub: string; email: string }) {
    const result = await this.messagingService.getTenantStatus();

    this.auditService.log(user.sub, user.email, 'MESSAGING_TENANT_STATUS_VIEW');

    return result;
  }

  @Get('tenant/:businessId/fix-checklist')
  async getFixChecklist(
    @Param('businessId') businessId: string,
    @CurrentUser() user: { sub: string; email: string },
  ) {
    const result = await this.messagingService.getFixChecklist(businessId);

    this.auditService.log(user.sub, user.email, 'MESSAGING_FIX_CHECKLIST_VIEW', {
      targetType: 'BUSINESS',
      targetId: businessId,
    });

    return result;
  }
}
