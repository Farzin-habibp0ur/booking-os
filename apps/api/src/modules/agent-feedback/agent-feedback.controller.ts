import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../common/tenant.guard';
import { BusinessId } from '../../common/decorators';
import { CurrentUser } from '../../common/decorators';
import { AgentFeedbackService } from './agent-feedback.service';

@Controller('agent-feedback')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class AgentFeedbackController {
  constructor(private feedbackService: AgentFeedbackService) {}

  @Post(':actionCardId')
  submitFeedback(
    @BusinessId() businessId: string,
    @CurrentUser() user: any,
    @Param('actionCardId') actionCardId: string,
    @Body() body: { rating: string; comment?: string },
  ) {
    return this.feedbackService.submitFeedback(businessId, actionCardId, user.staffId, body);
  }

  @Get('card/:actionCardId')
  getCardFeedback(
    @BusinessId() businessId: string,
    @Param('actionCardId') actionCardId: string,
  ) {
    return this.feedbackService.getFeedbackForCard(businessId, actionCardId);
  }

  @Get('stats')
  getStats(
    @BusinessId() businessId: string,
    @Query('agentType') agentType?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.feedbackService.getStats(businessId, {
      agentType,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Delete(':feedbackId')
  deleteFeedback(
    @BusinessId() businessId: string,
    @CurrentUser() user: any,
    @Param('feedbackId') feedbackId: string,
  ) {
    return this.feedbackService.deleteFeedback(businessId, feedbackId, user.staffId);
  }
}
