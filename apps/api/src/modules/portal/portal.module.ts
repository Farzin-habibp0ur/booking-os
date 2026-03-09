import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BookingModule } from '../booking/booking.module';
import { PortalController } from './portal.controller';
import { PortalAuthService } from './portal-auth.service';
import { PortalService } from './portal.service';

@Module({
  imports: [AuthModule, forwardRef(() => BookingModule)],
  controllers: [PortalController],
  providers: [PortalAuthService, PortalService],
  exports: [PortalAuthService, PortalService],
})
export class PortalModule {}
