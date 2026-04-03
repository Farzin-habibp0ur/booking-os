import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, Roles, AllowAnyRole } from '../../common/roles.guard';
import { BusinessId } from '../../common/decorators';
import { ConfigService } from '@nestjs/config';
import { MessagingService } from './messaging.service';
import { EmailChannelProvider } from '@booking-os/messaging-provider';
import { PrismaService } from '../../common/prisma.service';

@ApiTags('Messaging - Email')
@Controller('messaging/email')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
@AllowAnyRole()
@Roles('OWNER', 'ADMIN')
export class EmailChannelController {
  private readonly logger = new Logger(EmailChannelController.name);

  constructor(
    private configService: ConfigService,
    private messagingService: MessagingService,
    private prisma: PrismaService,
  ) {}

  /**
   * POST /messaging/email/test — send a test email
   */
  @Post('test')
  async sendTestEmail(
    @Body() body: { to: string; subject: string; message: string },
    @BusinessId() businessId: string,
  ) {
    if (!body.to || !body.subject || !body.message) {
      throw new BadRequestException('to, subject, and message are required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.to)) {
      throw new BadRequestException('Invalid email format');
    }

    // Fetch business email settings
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { channelSettings: true },
    });

    const channelSettings = (business?.channelSettings as any) || {};
    const emailConfig = channelSettings.email;

    if (!emailConfig?.apiKey || !emailConfig?.fromAddress) {
      throw new BadRequestException('Email provider not configured. Save provider settings first.');
    }

    try {
      const provider = new EmailChannelProvider({
        provider: emailConfig.provider || 'resend',
        apiKey: emailConfig.apiKey,
        fromAddress: emailConfig.fromAddress,
        fromName: emailConfig.fromName,
        replyToAddress: emailConfig.replyToAddress,
      });

      const result = await provider.sendMessage({
        to: body.to,
        body: body.message,
        subject: body.subject,
        businessId,
      });

      this.logger.log(`Test email sent for business ${businessId}: ${result.externalId}`);

      return { ok: true, externalId: result.externalId };
    } catch (err: any) {
      this.logger.error(`Test email failed for business ${businessId}: ${err.message}`);
      throw new BadRequestException(`Failed to send test email: ${err.message}`);
    }
  }

  /**
   * GET /messaging/email/dns-check — check DNS records for a domain
   */
  @Get('dns-check')
  async checkDns(@Query('domain') domain: string) {
    if (!domain) {
      throw new BadRequestException('domain query parameter is required');
    }

    // Basic domain format validation
    if (!domain.includes('.') || domain.length < 3) {
      throw new BadRequestException('Invalid domain format');
    }

    try {
      const result = await EmailChannelProvider.validateDomain(domain);

      this.logger.log(`DNS check for domain ${domain}: valid=${result.valid}`);

      return {
        domain,
        valid: result.valid,
        checks: result.checks,
      };
    } catch (err: any) {
      this.logger.error(`DNS check failed for domain ${domain}: ${err.message}`);
      throw new BadRequestException(`DNS check failed: ${err.message}`);
    }
  }
}
