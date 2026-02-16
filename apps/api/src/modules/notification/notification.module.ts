import { Module, Global } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { TemplateModule } from '../template/template.module';
import { BusinessModule } from '../business/business.module';

@Global()
@Module({
  imports: [TemplateModule, BusinessModule],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
