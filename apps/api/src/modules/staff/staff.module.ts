import { Module } from '@nestjs/common';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { AvailabilityModule } from '../availability/availability.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AvailabilityModule, AuthModule],
  controllers: [StaffController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
