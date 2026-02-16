import { Module, forwardRef } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { ReportsModule } from '../reports/reports.module';
import { AiModule } from '../ai/ai.module';
import { WaitlistModule } from '../waitlist/waitlist.module';

@Module({
  imports: [ReportsModule, forwardRef(() => AiModule), WaitlistModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
