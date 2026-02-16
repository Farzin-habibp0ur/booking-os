import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { CalendarSyncService } from './calendar-sync.service';

@Controller('ical')
export class IcalFeedController {
  constructor(private calendarSyncService: CalendarSyncService) {}

  @Get(':token.ics')
  async getIcalFeed(@Param('token') token: string, @Res() res: Response) {
    const feed = await this.calendarSyncService.generateIcalFeed(token);
    if (!feed) {
      throw new NotFoundException('Feed not found');
    }

    res.set({
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="bookings.ics"',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    res.send(feed);
  }
}
