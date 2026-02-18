import { Module } from '@nestjs/common';
import { ActionCardController } from './action-card.controller';
import { ActionCardService } from './action-card.service';
import { InboxGatewayModule } from '../../common/inbox.gateway.module';

@Module({
  imports: [InboxGatewayModule],
  controllers: [ActionCardController],
  providers: [ActionCardService],
  exports: [ActionCardService],
})
export class ActionCardModule {}
