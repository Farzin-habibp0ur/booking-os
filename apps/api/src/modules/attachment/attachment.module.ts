import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { AttachmentController } from './attachment.controller';
import { AttachmentService } from './attachment.service';
import { InboxGatewayModule } from '../../common/inbox.gateway.module';

@Module({
  imports: [
    InboxGatewayModule,
    MulterModule.register({
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    }),
  ],
  controllers: [AttachmentController],
  providers: [AttachmentService],
  exports: [AttachmentService],
})
export class AttachmentModule {}
