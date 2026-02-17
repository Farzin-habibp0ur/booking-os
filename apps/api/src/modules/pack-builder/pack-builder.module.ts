import { Module } from '@nestjs/common';
import { PackBuilderController } from './pack-builder.controller';
import { PackBuilderService } from './pack-builder.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [PackBuilderController],
  providers: [PackBuilderService],
  exports: [PackBuilderService],
})
export class PackBuilderModule {}
