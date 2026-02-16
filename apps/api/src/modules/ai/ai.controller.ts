import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../common/tenant.guard';
import { BusinessId, CurrentUser } from '../../common/decorators';
import { BusinessService } from '../business/business.service';
import { AiService } from './ai.service';

@ApiTags('AI')
@Controller('ai')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class AiController {
  constructor(
    private businessService: BusinessService,
    private aiService: AiService,
  ) {}

  @Get('settings')
  async getSettings(@BusinessId() businessId: string) {
    const business = await this.businessService.findById(businessId);
    if (!business) throw new BadRequestException('Business not found');
    const defaults = {
      enabled: false,
      autoReplySuggestions: true,
      bookingAssistant: true,
      personality: 'friendly and professional',
      autoReply: {
        enabled: false,
        mode: 'all',
        selectedIntents: ['GENERAL', 'BOOK_APPOINTMENT', 'CANCEL', 'RESCHEDULE', 'INQUIRY'],
      },
    };
    const raw = (business.aiSettings || {}) as any;
    const merged = { ...defaults, ...(typeof raw === 'object' ? raw : {}) };
    if (typeof raw === 'object' && raw.autoReply) {
      merged.autoReply = { ...defaults.autoReply, ...raw.autoReply };
    }
    return merged;
  }

  @Patch('settings')
  async updateSettings(
    @BusinessId() businessId: string,
    @Body()
    body: {
      enabled?: boolean;
      autoReplySuggestions?: boolean;
      bookingAssistant?: boolean;
      personality?: string;
      autoReply?: { enabled: boolean; mode: 'all' | 'selected'; selectedIntents: string[] };
    },
  ) {
    return this.businessService.updateAiSettings(businessId, body);
  }

  @Post('conversations/:id/summary')
  async generateSummary(@BusinessId() businessId: string, @Param('id') conversationId: string) {
    const summary = await this.aiService.generateAndStoreSummary(conversationId);
    return { summary };
  }

  @Post('conversations/:id/booking-confirm')
  async confirmBooking(@BusinessId() businessId: string, @Param('id') conversationId: string) {
    return this.aiService.confirmBooking(businessId, conversationId);
  }

  @Post('conversations/:id/booking-cancel')
  async cancelBooking(@BusinessId() businessId: string, @Param('id') conversationId: string) {
    await this.aiService.clearBookingState(businessId, conversationId);
    return { ok: true };
  }

  @Post('conversations/:id/cancel-confirm')
  async confirmCancelAppointment(
    @BusinessId() businessId: string,
    @Param('id') conversationId: string,
  ) {
    return this.aiService.confirmCancel(businessId, conversationId);
  }

  @Post('conversations/:id/cancel-dismiss')
  async dismissCancel(@BusinessId() businessId: string, @Param('id') conversationId: string) {
    await this.aiService.clearCancelState(businessId, conversationId);
    return { ok: true };
  }

  @Post('conversations/:id/reschedule-confirm')
  async confirmReschedule(@BusinessId() businessId: string, @Param('id') conversationId: string) {
    return this.aiService.confirmReschedule(businessId, conversationId);
  }

  @Post('conversations/:id/reschedule-dismiss')
  async dismissReschedule(@BusinessId() businessId: string, @Param('id') conversationId: string) {
    await this.aiService.clearRescheduleState(businessId, conversationId);
    return { ok: true };
  }

  @Post('conversations/:id/resume-auto-reply')
  async resumeAutoReply(@BusinessId() businessId: string, @Param('id') conversationId: string) {
    await this.aiService.resumeAutoReply(businessId, conversationId);
    return { ok: true };
  }

  @Post('customers/:id/chat')
  async customerChat(
    @BusinessId() businessId: string,
    @Param('id') customerId: string,
    @Body() body: { question: string },
  ) {
    if (!body.question?.trim()) throw new BadRequestException('Question is required');
    return this.aiService.customerChat(businessId, customerId, body.question);
  }
}
