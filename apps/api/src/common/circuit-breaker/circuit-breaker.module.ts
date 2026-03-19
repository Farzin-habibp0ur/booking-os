import { Global, Module, forwardRef } from '@nestjs/common';
import { CircuitBreakerService } from './circuit-breaker.service';
import { InboxGatewayModule } from '../inbox.gateway.module';

@Global()
@Module({
  imports: [forwardRef(() => InboxGatewayModule)],
  providers: [CircuitBreakerService],
  exports: [CircuitBreakerService],
})
export class CircuitBreakerModule {}
