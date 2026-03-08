import { Module } from '@nestjs/common';
import { WeeklyDigestService } from './weekly-digest.service';

@Module({
  providers: [WeeklyDigestService],
  exports: [WeeklyDigestService],
})
export class WeeklyDigestModule {}
