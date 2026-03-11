import { Module } from '@nestjs/common';
import { TreatmentPlanController } from './treatment-plan.controller';
import { TreatmentPlanService } from './treatment-plan.service';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [TreatmentPlanController],
  providers: [TreatmentPlanService],
  exports: [TreatmentPlanService],
})
export class TreatmentPlanModule {}
