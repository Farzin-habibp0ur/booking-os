import { Module } from '@nestjs/common';
import { BusinessController } from './business.controller';
import { BusinessService } from './business.service';
import { VerticalPackModule } from '../vertical-pack/vertical-pack.module';

@Module({
  imports: [VerticalPackModule],
  controllers: [BusinessController],
  providers: [BusinessService],
  exports: [BusinessService],
})
export class BusinessModule {}
