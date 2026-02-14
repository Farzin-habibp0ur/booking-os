import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
  ],
})
export class AppModule {}
