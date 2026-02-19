import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AttachmentService } from './attachment.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';
import * as fs from 'fs';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  promises: {
    writeFile: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('AttachmentService', () => {
  let service: AttachmentService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      providers: [AttachmentService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(AttachmentService);
  });

  describe('validateFile', () => {
    it('accepts valid JPEG image under 5MB', () => {
      expect(() =>
        service.validateFile({
          mimetype: 'image/jpeg',
          size: 1024 * 1024,
          originalname: 'photo.jpg',
        }),
      ).not.toThrow();
    });

    it('accepts valid PDF under 10MB', () => {
      expect(() =>
        service.validateFile({
          mimetype: 'application/pdf',
          size: 5 * 1024 * 1024,
          originalname: 'doc.pdf',
        }),
      ).not.toThrow();
    });

    it('accepts valid audio under 2MB', () => {
      expect(() =>
        service.validateFile({
          mimetype: 'audio/mpeg',
          size: 1 * 1024 * 1024,
          originalname: 'voice.mp3',
        }),
      ).not.toThrow();
    });

    it('rejects unsupported file type', () => {
      expect(() =>
        service.validateFile({
          mimetype: 'application/zip',
          size: 1024,
          originalname: 'archive.zip',
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects image over 5MB', () => {
      expect(() =>
        service.validateFile({
          mimetype: 'image/png',
          size: 6 * 1024 * 1024,
          originalname: 'large.png',
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects document over 10MB', () => {
      expect(() =>
        service.validateFile({
          mimetype: 'application/pdf',
          size: 11 * 1024 * 1024,
          originalname: 'huge.pdf',
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects audio over 2MB', () => {
      expect(() =>
        service.validateFile({
          mimetype: 'audio/wav',
          size: 3 * 1024 * 1024,
          originalname: 'long.wav',
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe('getContentCategory', () => {
    it('returns IMAGE for image types', () => {
      expect(service.getContentCategory('image/jpeg')).toBe('IMAGE');
      expect(service.getContentCategory('image/png')).toBe('IMAGE');
    });

    it('returns DOCUMENT for document types', () => {
      expect(service.getContentCategory('application/pdf')).toBe('DOCUMENT');
    });

    it('returns AUDIO for audio types', () => {
      expect(service.getContentCategory('audio/mpeg')).toBe('AUDIO');
    });
  });

  describe('upload', () => {
    const mockFile = {
      buffer: Buffer.from('test'),
      mimetype: 'image/jpeg',
      size: 1024,
      originalname: 'photo.jpg',
    };

    it('uploads file and creates message with attachment', async () => {
      const conversation = { id: 'conv1', businessId: 'biz1' };
      prisma.conversation.findFirst.mockResolvedValue(conversation as any);

      const message = {
        id: 'msg1',
        conversationId: 'conv1',
        direction: 'OUTBOUND',
        contentType: 'IMAGE',
        attachments: [{ id: 'att1', fileName: 'photo.jpg' }],
      };
      prisma.message.create.mockResolvedValue(message as any);
      prisma.conversation.update.mockResolvedValue(conversation as any);

      const result = await service.upload('biz1', 'conv1', 'staff1', mockFile);

      expect(result).toEqual(message);
      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            conversationId: 'conv1',
            direction: 'OUTBOUND',
            senderStaffId: 'staff1',
            contentType: 'IMAGE',
          }),
        }),
      );
    });

    it('throws NotFoundException if conversation not found', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);

      await expect(service.upload('biz1', 'conv1', 'staff1', mockFile)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException for unsupported file type', async () => {
      await expect(
        service.upload('biz1', 'conv1', 'staff1', {
          ...mockFile,
          mimetype: 'application/zip',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findById', () => {
    it('returns attachment when found', async () => {
      const attachment = { id: 'att1', businessId: 'biz1', fileName: 'photo.jpg' };
      prisma.messageAttachment.findFirst.mockResolvedValue(attachment as any);

      const result = await service.findById('biz1', 'att1');
      expect(result).toEqual(attachment);
    });

    it('throws NotFoundException when not found', async () => {
      prisma.messageAttachment.findFirst.mockResolvedValue(null);

      await expect(service.findById('biz1', 'att1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getFilePath', () => {
    it('returns file path for existing attachment', async () => {
      const attachment = {
        id: 'att1',
        businessId: 'biz1',
        fileName: 'photo.jpg',
        fileType: 'image/jpeg',
        storageKey: 'abc123.jpg',
      };
      prisma.messageAttachment.findFirst.mockResolvedValue(attachment as any);
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const result = await service.getFilePath('biz1', 'att1');
      expect(result.fileName).toBe('photo.jpg');
      expect(result.fileType).toBe('image/jpeg');
    });

    it('throws NotFoundException when file not on disk', async () => {
      const attachment = {
        id: 'att1',
        businessId: 'biz1',
        storageKey: 'missing.jpg',
        fileName: 'photo.jpg',
        fileType: 'image/jpeg',
      };
      prisma.messageAttachment.findFirst.mockResolvedValue(attachment as any);
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await expect(service.getFilePath('biz1', 'att1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByMessage', () => {
    it('returns attachments for a message', async () => {
      const attachments = [{ id: 'att1', messageId: 'msg1' }];
      prisma.messageAttachment.findMany.mockResolvedValue(attachments as any);

      const result = await service.findByMessage('msg1');
      expect(result).toEqual(attachments);
    });
  });
});
