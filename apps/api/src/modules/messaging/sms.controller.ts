import { Controller, Post, Body, UseGuards, BadRequestException, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, Roles } from '../../common/roles.guard';
import { BusinessId } from '../../common/decorators';
import { MessagingService } from './messaging.service';

@ApiTags('SMS')
@Controller('messaging')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
export class SmsController {
  private readonly logger = new Logger(SmsController.name);

  constructor(private messagingService: MessagingService) {}

  @Post('test-sms')
  @Roles('OWNER', 'ADMIN')
  async testSms(@Body() body: { to: string; message: string }, @BusinessId() businessId: string) {
    const smsProvider = this.messagingService.getSmsProvider();
    if (!smsProvider) {
      throw new BadRequestException('SMS provider not configured');
    }

    if (!body.to || !body.message) {
      throw new BadRequestException('Both "to" and "message" are required');
    }

    try {
      this.logger.log(`Test SMS requested by business ${businessId} to ${body.to}`);
      const result = await smsProvider.sendMessage({
        to: body.to,
        body: body.message,
        businessId,
      });
      return { ok: true, externalId: result.externalId };
    } catch (err: any) {
      this.logger.error(`Test SMS failed: ${err.message}`, err.stack);
      throw new BadRequestException(`SMS send failed: ${err.message}`);
    }
  }
}
