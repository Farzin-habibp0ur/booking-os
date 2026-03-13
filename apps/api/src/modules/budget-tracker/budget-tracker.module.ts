import { Module } from '@nestjs/common';
import { BudgetTrackerController } from './budget-tracker.controller';
import { BudgetTrackerService } from './budget-tracker.service';

@Module({
  controllers: [BudgetTrackerController],
  providers: [BudgetTrackerService],
  exports: [BudgetTrackerService],
})
export class BudgetTrackerModule {}
