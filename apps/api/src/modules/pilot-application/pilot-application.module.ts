import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TokenService } from '../../common/token.service';
import {
  AdminPilotApplicationController,
  PilotApplicationController,
} from './pilot-application.controller';
import { PilotApplicationService } from './pilot-application.service';

@Module({
  imports: [ConfigModule],
  controllers: [PilotApplicationController, AdminPilotApplicationController],
  providers: [PilotApplicationService, TokenService],
})
export class PilotApplicationModule {}
