import { Module } from '@nestjs/common';
import {
  AdminPilotApplicationController,
  PilotApplicationController,
} from './pilot-application.controller';
import { PilotApplicationService } from './pilot-application.service';

@Module({
  controllers: [PilotApplicationController, AdminPilotApplicationController],
  providers: [PilotApplicationService],
})
export class PilotApplicationModule {}
