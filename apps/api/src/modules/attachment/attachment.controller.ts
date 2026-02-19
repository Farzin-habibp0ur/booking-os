import {
  Controller,
  Post,
  Get,
  Param,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { AttachmentService } from './attachment.service';
import { BusinessId, CurrentUser } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';
import { InboxGateway } from '../../common/inbox.gateway';

@ApiTags('Attachments')
@Controller()
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class AttachmentController {
  constructor(
    private attachmentService: AttachmentService,
    private inboxGateway: InboxGateway,
  ) {}

  @Post('conversations/:id/messages/media')
  @UseInterceptors(FileInterceptor('file'))
  async uploadMedia(
    @BusinessId() businessId: string,
    @Param('id') conversationId: string,
    @CurrentUser('sub') staffId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const message = await this.attachmentService.upload(businessId, conversationId, staffId, {
      buffer: file.buffer,
      mimetype: file.mimetype,
      size: file.size,
      originalname: file.originalname,
    });

    this.inboxGateway.notifyNewMessage(businessId, message);

    return message;
  }

  @Get('attachments/:id/download')
  async downloadAttachment(
    @BusinessId() businessId: string,
    @Param('id') attachmentId: string,
    @Res() res: Response,
  ) {
    const { filePath, fileName, fileType } = await this.attachmentService.getFilePath(
      businessId,
      attachmentId,
    );

    // M1 fix: Sanitize filename to prevent header injection
    const sanitizedFileName = fileName
      .replace(/["\\\r\n]/g, '_')
      .replace(/[^\x20-\x7E]/g, '_')
      .substring(0, 255);
    res.setHeader('Content-Type', fileType);
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizedFileName}"`);
    res.sendFile(filePath);
  }
}
