import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConsoleBusinessesController } from './console-businesses.controller';
import { ConsoleBusinessesService } from './console-businesses.service';
import { ConsoleViewAsController } from './console-view-as.controller';
import { ConsoleViewAsService } from './console-view-as.service';
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
  controllers: [ConsoleBusinessesController, ConsoleViewAsController],
  providers: [ConsoleBusinessesService, ConsoleViewAsService, PlatformAuditService],
  exports: [PlatformAuditService],
})
export class ConsoleModule {}
