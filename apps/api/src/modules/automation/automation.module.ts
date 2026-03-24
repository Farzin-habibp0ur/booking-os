import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AutomationController } from './automation.controller';
import { AutomationService } from './automation.service';
import { AutomationExecutorService } from './automation-executor.service';
import { TestimonialsModule } from '../testimonials/testimonials.module';
import { QUEUE_NAMES } from '../../common/queue/queue.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.NOTIFICATIONS }),
    forwardRef(() => TestimonialsModule),
  ],
  controllers: [AutomationController],
  providers: [AutomationService, AutomationExecutorService],
  exports: [AutomationService, AutomationExecutorService],
})
export class AutomationModule {}
