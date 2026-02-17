import { Controller, Get, Param, Res, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CalendarSyncService } from './calendar-sync.service';

@ApiTags('iCal Feed')
@Controller('ical')
export class IcalFeedController {
  constructor(private calendarSyncService: CalendarSyncService) {}

  @Get(':token.ics')
  async getIcalFeed(@Param('token') token: string, @Res() res: Response) {
    const feed = await this.calendarSyncService.generateIcalFeed(token);
    if (!feed) {
      throw new NotFoundException('Feed not found');
    }
    // H7 fix: Return 401 for expired iCal feed tokens
    if (feed === 'EXPIRED') {
      throw new UnauthorizedException('iCal feed token has expired. Please regenerate your feed URL.');
    }

    res.set({
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="bookings.ics"',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    res.send(feed);
  }
}
