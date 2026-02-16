import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CalendarSyncService } from './calendar-sync.service';
import { CalendarSyncController } from './calendar-sync.controller';
import { IcalFeedController } from './ical-feed.controller';
import { GoogleCalendarProvider } from './providers/google-calendar.provider';
import { OutlookCalendarProvider } from './providers/outlook-calendar.provider';

@Global()
@Module({
  imports: [ConfigModule],
  controllers: [CalendarSyncController, IcalFeedController],
  providers: [CalendarSyncService, GoogleCalendarProvider, OutlookCalendarProvider],
  exports: [CalendarSyncService],
})
export class CalendarSyncModule {}
