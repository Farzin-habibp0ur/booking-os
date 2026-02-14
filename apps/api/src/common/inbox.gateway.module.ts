import { Global, Module } from '@nestjs/common';
import { InboxGateway } from './inbox.gateway';

@Global()
@Module({
  providers: [InboxGateway],
  exports: [InboxGateway],
})
export class InboxGatewayModule {}
