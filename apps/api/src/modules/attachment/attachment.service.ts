import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface StorageProvider {
  save(key: string, buffer: Buffer): Promise<void>;
  getPath(key: string): string;
  delete(key: string): Promise<void>;
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_DOC_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm'];

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_DOC_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_AUDIO_SIZE = 2 * 1024 * 1024; // 2MB

@Injectable()
export class AttachmentService {
  private readonly logger = new Logger(AttachmentService.name);
  private readonly uploadDir: string;

  constructor(private prisma: PrismaService) {
    this.uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  validateFile(file: { mimetype: string; size: number; originalname: string }) {
    const { mimetype, size } = file;

    const isImage = ALLOWED_IMAGE_TYPES.includes(mimetype);
    const isDoc = ALLOWED_DOC_TYPES.includes(mimetype);
    const isAudio = ALLOWED_AUDIO_TYPES.includes(mimetype);

    if (!isImage && !isDoc && !isAudio) {
      throw new BadRequestException(
        `Unsupported file type: ${mimetype}. Allowed: images (JPEG, PNG, GIF, WebP), documents (PDF, Word, TXT), audio (MP3, OGG, WAV, WebM)`,
      );
    }

    if (isImage && size > MAX_IMAGE_SIZE) {
      throw new BadRequestException(
        `Image files must be under 5MB. Received: ${(size / 1024 / 1024).toFixed(1)}MB`,
      );
    }
    if (isDoc && size > MAX_DOC_SIZE) {
      throw new BadRequestException(
        `Document files must be under 10MB. Received: ${(size / 1024 / 1024).toFixed(1)}MB`,
      );
    }
    if (isAudio && size > MAX_AUDIO_SIZE) {
      throw new BadRequestException(
        `Audio files must be under 2MB. Received: ${(size / 1024 / 1024).toFixed(1)}MB`,
      );
    }
  }

  getContentCategory(mimetype: string): 'IMAGE' | 'DOCUMENT' | 'AUDIO' {
    if (ALLOWED_IMAGE_TYPES.includes(mimetype)) return 'IMAGE';
    if (ALLOWED_DOC_TYPES.includes(mimetype)) return 'DOCUMENT';
    return 'AUDIO';
  }

  async saveFile(buffer: Buffer, originalName: string): Promise<string> {
    const ext = path.extname(originalName);
    const key = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(this.uploadDir, key);
    await fs.promises.writeFile(filePath, buffer);
    return key;
  }

  async upload(
    businessId: string,
    conversationId: string,
    staffId: string,
    file: { buffer: Buffer; mimetype: string; size: number; originalname: string },
  ) {
    this.validateFile(file);

    // Verify conversation belongs to business
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, businessId },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const storageKey = await this.saveFile(file.buffer, file.originalname);
    const contentCategory = this.getContentCategory(file.mimetype);

    // Create message with attachment
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        direction: 'OUTBOUND',
        senderStaffId: staffId,
        content: `[${contentCategory}] ${file.originalname}`,
        contentType: contentCategory,
        attachments: {
          create: {
            businessId,
            fileName: file.originalname,
            fileType: file.mimetype,
            fileSize: file.size,
            storageKey,
          },
        },
      },
      include: {
        senderStaff: { select: { id: true, name: true } },
        attachments: true,
      },
    });

    // Update conversation
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date(), status: 'WAITING' },
    });

    return message;
  }

  async findById(businessId: string, attachmentId: string) {
    const attachment = await this.prisma.messageAttachment.findFirst({
      where: { id: attachmentId, businessId },
    });
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }
    return attachment;
  }

  async getFilePath(
    businessId: string,
    attachmentId: string,
  ): Promise<{ filePath: string; fileName: string; fileType: string }> {
    const attachment = await this.findById(businessId, attachmentId);
    const filePath = path.join(this.uploadDir, attachment.storageKey);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('File not found on disk');
    }

    return {
      filePath,
      fileName: attachment.fileName,
      fileType: attachment.fileType,
    };
  }

  async findByMessage(messageId: string) {
    return this.prisma.messageAttachment.findMany({
      where: { messageId },
    });
  }
}
