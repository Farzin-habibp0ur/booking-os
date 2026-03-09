import { Module, Global } from '@nestjs/common';
import { EmailSequenceService } from './email-sequences.service';
import { EmailSequenceController } from './email-sequences.controller';

@Global()
@Module({
  controllers: [EmailSequenceController],
  providers: [EmailSequenceService],
  exports: [EmailSequenceService],
})
export class EmailSequenceModule {}
