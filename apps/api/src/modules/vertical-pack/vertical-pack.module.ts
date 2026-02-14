import { Module } from '@nestjs/common';
import { VerticalPackController } from './vertical-pack.controller';
import { VerticalPackService } from './vertical-pack.service';

@Module({
  controllers: [VerticalPackController],
  providers: [VerticalPackService],
  exports: [VerticalPackService],
})
export class VerticalPackModule {}
