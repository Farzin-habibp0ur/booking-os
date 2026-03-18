import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InstagramAuthService } from './instagram-auth.service';
import { InstagramAuthController } from './instagram-auth.controller';

@Module({
  imports: [ConfigModule],
  controllers: [InstagramAuthController],
  providers: [InstagramAuthService],
  exports: [InstagramAuthService],
})
export class InstagramAuthModule {}
