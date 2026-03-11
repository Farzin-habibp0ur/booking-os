import { Module } from '@nestjs/common';
import { RecurringClassController } from './recurring-class.controller';
import { RecurringClassService } from './recurring-class.service';

@Module({
  controllers: [RecurringClassController],
  providers: [RecurringClassService],
  exports: [RecurringClassService],
})
export class RecurringClassModule {}
