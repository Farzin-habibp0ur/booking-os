import { Module } from '@nestjs/common';
import { RoiController } from './roi.controller';
import { RoiService } from './roi.service';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [ReportsModule],
  controllers: [RoiController],
  providers: [RoiService],
})
export class RoiModule {}
