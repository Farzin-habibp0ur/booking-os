import { Controller, Get, Post, Param, Query, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SelfServeService } from './self-serve.service';

@ApiTags('Self-Serve')
@Controller('self-serve')
export class SelfServeController {
  constructor(private selfServeService: SelfServeService) {}

  @Get('validate/reschedule/:token')
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  validateRescheduleToken(@Param('token') token: string) {
    return this.selfServeService.getBookingSummary(token, 'RESCHEDULE_LINK');
  }

  @Get('validate/cancel/:token')
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  validateCancelToken(@Param('token') token: string) {
    return this.selfServeService.getBookingSummary(token, 'CANCEL_LINK');
  }

  @Get('availability/:token')
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  getAvailability(@Param('token') token: string, @Query('date') date: string) {
    return this.selfServeService.getAvailability(token, date);
  }

  @Post('reschedule/:token')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  reschedule(@Param('token') token: string, @Body() body: { startTime: string; staffId?: string }) {
    return this.selfServeService.executeReschedule(token, body.startTime, body.staffId);
  }

  @Post('cancel/:token')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  cancel(@Param('token') token: string, @Body() body: { reason?: string }) {
    return this.selfServeService.executeCancel(token, body.reason);
  }

  @Get('validate/waitlist-claim/:token')
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  validateWaitlistClaimToken(@Param('token') token: string) {
    return this.selfServeService.getWaitlistClaimSummary(token);
  }

  @Post('claim-waitlist/:token')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  claimWaitlist(@Param('token') token: string) {
    return this.selfServeService.claimWaitlistSlot(token);
  }
}
