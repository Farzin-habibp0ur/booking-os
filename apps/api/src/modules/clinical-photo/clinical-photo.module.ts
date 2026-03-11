import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ClinicalPhotoController } from './clinical-photo.controller';
import { ClinicalPhotoService } from './clinical-photo.service';

@Module({
  imports: [MulterModule.register({ limits: { fileSize: 5 * 1024 * 1024 } })],
  controllers: [ClinicalPhotoController],
  providers: [ClinicalPhotoService],
  exports: [ClinicalPhotoService],
})
export class ClinicalPhotoModule {}
