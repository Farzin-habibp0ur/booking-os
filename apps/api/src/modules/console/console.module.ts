import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConsoleBusinessesController } from './console-businesses.controller';
import { ConsoleBusinessesService } from './console-businesses.service';
import { ConsoleViewAsController } from './console-view-as.controller';
import { ConsoleViewAsService } from './console-view-as.service';
import { ConsoleOverviewController } from './console-overview.controller';
import { ConsoleOverviewService } from './console-overview.service';
import { ConsoleAuditController } from './console-audit.controller';
import { ConsoleAuditService } from './console-audit.service';
import { ConsoleHealthController } from './console-health.controller';
import { ConsoleHealthService } from './console-health.service';
import { ConsoleSupportController } from './console-support.controller';
import { ConsoleSupportService } from './console-support.service';
import {
  ConsoleBillingController,
  ConsoleBusinessBillingController,
} from './console-billing.controller';
import { ConsoleBillingService } from './console-billing.service';
import { ConsolePacksController } from './console-packs.controller';
import { ConsolePacksService } from './console-packs.service';
import { ConsoleSkillsController } from './console-skills.controller';
import { ConsoleSkillsService } from './console-skills.service';
import { ConsoleAgentsController } from './console-agents.controller';
import { ConsoleAgentsService } from './console-agents.service';
import { ConsoleMessagingController } from './console-messaging.controller';
import { ConsoleMessagingService } from './console-messaging.service';
import { ConsoleSettingsController } from './console-settings.controller';
import { ConsoleSettingsService } from './console-settings.service';
import { PlatformAuditService } from './platform-audit.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRATION', '15m') },
      }),
    }),
  ],
  controllers: [
    ConsoleBusinessesController,
    ConsoleViewAsController,
    ConsoleOverviewController,
    ConsoleAuditController,
    ConsoleHealthController,
    ConsoleSupportController,
    ConsoleBillingController,
    ConsoleBusinessBillingController,
    ConsolePacksController,
    ConsoleSkillsController,
    ConsoleAgentsController,
    ConsoleMessagingController,
    ConsoleSettingsController,
  ],
  providers: [
    ConsoleBusinessesService,
    ConsoleViewAsService,
    ConsoleOverviewService,
    ConsoleAuditService,
    ConsoleHealthService,
    ConsoleSupportService,
    ConsoleBillingService,
    ConsolePacksService,
    ConsoleSkillsService,
    ConsoleAgentsService,
    ConsoleMessagingService,
    ConsoleSettingsService,
    PlatformAuditService,
  ],
  exports: [PlatformAuditService],
})
export class ConsoleModule {}
