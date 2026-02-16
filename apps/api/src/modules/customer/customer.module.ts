import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { ProfileExtractor } from '../ai/profile-extractor';
import { ClaudeClient } from '../ai/claude.client';

@Module({
  imports: [MulterModule.register({ limits: { fileSize: 5 * 1024 * 1024 } })],
  controllers: [CustomerController],
  providers: [CustomerService, ProfileExtractor, ClaudeClient],
  exports: [CustomerService],
})
export class CustomerModule {}
