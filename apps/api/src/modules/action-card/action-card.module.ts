import { Module } from '@nestjs/common';
import { ActionCardController } from './action-card.controller';
import { ActionCardService } from './action-card.service';
import { ActionCardExecutorService } from './action-card-executor.service';
import { InboxGatewayModule } from '../../common/inbox.gateway.module';
import { OutboundModule } from '../outbound/outbound.module';
import { CustomerIdentityModule } from '../customer-identity/customer-identity.module';

@Module({
  imports: [InboxGatewayModule, OutboundModule, CustomerIdentityModule],
  controllers: [ActionCardController],
  providers: [ActionCardService, ActionCardExecutorService],
  exports: [ActionCardService, ActionCardExecutorService],
})
export class ActionCardModule {}
