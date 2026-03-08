import { Module, Global } from '@nestjs/common';
import { DunningService } from './dunning.service';

@Global()
@Module({
  providers: [DunningService],
  exports: [DunningService],
})
export class DunningModule {}
