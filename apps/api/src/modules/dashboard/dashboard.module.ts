import { Module, forwardRef } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { ReportsModule } from '../reports/reports.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [ReportsModule, forwardRef(() => AiModule)],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
