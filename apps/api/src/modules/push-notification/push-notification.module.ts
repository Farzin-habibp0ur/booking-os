import { Module } from '@nestjs/common';
import { PushNotificationService } from './push-notification.service';
import { DeviceTokenModule } from '../device-token/device-token.module';

@Module({
  imports: [DeviceTokenModule],
  providers: [PushNotificationService],
  exports: [PushNotificationService],
})
export class PushNotificationModule {}
