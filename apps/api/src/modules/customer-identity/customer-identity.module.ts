import { Module } from '@nestjs/common';
import { CustomerIdentityService } from './customer-identity.service';
import { CustomerModule } from '../customer/customer.module';

@Module({
  imports: [CustomerModule],
  providers: [CustomerIdentityService],
  exports: [CustomerIdentityService],
})
export class CustomerIdentityModule {}
