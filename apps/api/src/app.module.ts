import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './common/prisma.module';
import { InboxGatewayModule } from './common/inbox.gateway.module';
import { AuthModule } from './modules/auth/auth.module';
import { BusinessModule } from './modules/business/business.module';
import { StaffModule } from './modules/staff/staff.module';
import { CustomerModule } from './modules/customer/customer.module';
import { ServiceModule } from './modules/service/service.module';
import { BookingModule } from './modules/booking/booking.module';
import { ConversationModule } from './modules/conversation/conversation.module';
import { MessageModule } from './modules/message/message.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { ReminderModule } from './modules/reminder/reminder.module';
import { VerticalPackModule } from './modules/vertical-pack/vertical-pack.module';
import { ReportsModule } from './modules/reports/reports.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { TemplateModule } from './modules/template/template.module';
import { AvailabilityModule } from './modules/availability/availability.module';
import { TranslationModule } from './modules/translation/translation.module';
import { AiModule } from './modules/ai/ai.module';
import { HealthModule } from './modules/health/health.module';
import { BillingModule } from './modules/billing/billing.module';
import { EmailModule } from './modules/email/email.module';
import { QueueModule } from './common/queue/queue.module';
import { NotificationModule } from './modules/notification/notification.module';
import { PublicBookingModule } from './modules/public-booking/public-booking.module';
import { CalendarSyncModule } from './modules/calendar-sync/calendar-sync.module';
import { SelfServeModule } from './modules/self-serve/self-serve.module';
import { RoiModule } from './modules/roi/roi.module';
import { WaitlistModule } from './modules/waitlist/waitlist.module';
import { SearchModule } from './modules/search/search.module';
import { CampaignModule } from './modules/campaign/campaign.module';
import { OfferModule } from './modules/offer/offer.module';
import { AutomationModule } from './modules/automation/automation.module';
import { LocationModule } from './modules/location/location.module';
import { PackBuilderModule } from './modules/pack-builder/pack-builder.module';
import { QuoteModule } from './modules/quote/quote.module';
import { SavedViewModule } from './modules/saved-view/saved-view.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
        genReqId: (req) => req.headers['x-request-id'] || crypto.randomUUID(),
        redact: ['req.headers.authorization', 'req.headers.cookie'],
        autoLogging: {
          ignore: (req) => req.url === '/api/v1/health',
        },
      },
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    InboxGatewayModule,
    AuthModule,
    BusinessModule,
    StaffModule,
    CustomerModule,
    ServiceModule,
    BookingModule,
    ConversationModule,
    MessageModule,
    MessagingModule,
    ReminderModule,
    VerticalPackModule,
    ReportsModule,
    DashboardModule,
    TemplateModule,
    AvailabilityModule,
    TranslationModule,
    AiModule,
    HealthModule,
    BillingModule,
    EmailModule,
    NotificationModule,
    PublicBookingModule,
    CalendarSyncModule,
    SelfServeModule,
    RoiModule,
    WaitlistModule,
    SearchModule,
    CampaignModule,
    OfferModule,
    AutomationModule,
    LocationModule,
    PackBuilderModule,
    QuoteModule,
    SavedViewModule,
    process.env.REDIS_URL ? QueueModule.forRootWithRedis() : QueueModule.forRoot(),
  ],
})
export class AppModule {}
