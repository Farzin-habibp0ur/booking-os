import { Global, Module } from '@nestjs/common';
import { ActionHistoryController } from './action-history.controller';
import { ActionHistoryService } from './action-history.service';

@Global()
@Module({
  controllers: [ActionHistoryController],
  providers: [ActionHistoryService],
  exports: [ActionHistoryService],
})
export class ActionHistoryModule {}
