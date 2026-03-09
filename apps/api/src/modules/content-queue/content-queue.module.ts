import { Module } from '@nestjs/common';
import { ContentQueueController } from './content-queue.controller';
import { ContentQueueService } from './content-queue.service';

@Module({
  controllers: [ContentQueueController],
  providers: [ContentQueueService],
  exports: [ContentQueueService],
})
export class ContentQueueModule {}
