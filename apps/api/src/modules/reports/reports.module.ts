import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportScheduleService } from './report-schedule.service';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportScheduleService],
  exports: [ReportsService, ReportScheduleService],
})
export class ReportsModule {}
