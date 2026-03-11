import { Test, TestingModule } from '@nestjs/testing';
import { ClinicalPhotoService } from './clinical-photo.service';
import { PrismaService } from '../../common/prisma.service';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  promises: {
    writeFile: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('ClinicalPhotoService', () => {
  let service: ClinicalPhotoService;
  let prisma: any;

  const mockPrisma = {
    business: { findUnique: jest.fn() },
    customer: { findFirst: jest.fn() },
    booking: { findFirst: jest.fn() },
    clinicalPhoto: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    photoComparison: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClinicalPhotoService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ClinicalPhotoService>(ClinicalPhotoService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  const businessId = 'biz-1';
  const mockFile = {
    buffer: Buffer.from('fake-image'),
    mimetype: 'image/jpeg',
    size: 1024,
    originalname: 'photo.jpg',
  };

  describe('upload', () => {
    it('should reject non-aesthetic businesses', async () => {
      mockPrisma.business.findUnique.mockResolvedValue({ verticalPack: 'general' });

      await expect(
        service.upload(businessId, { customerId: 'c1', type: 'BEFORE' as any, bodyArea: 'face' }, mockFile),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject unsupported file types', async () => {
      mockPrisma.business.findUnique.mockResolvedValue({ verticalPack: 'aesthetic' });

      await expect(
        service.upload(
          businessId,
          { customerId: 'c1', type: 'BEFORE' as any, bodyArea: 'face' },
          { ...mockFile, mimetype: 'application/pdf' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject files over 5MB', async () => {
      mockPrisma.business.findUnique.mockResolvedValue({ verticalPack: 'aesthetic' });

      await expect(
        service.upload(
          businessId,
          { customerId: 'c1', type: 'BEFORE' as any, bodyArea: 'face' },
          { ...mockFile, size: 6 * 1024 * 1024 },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if customer not found', async () => {
      mockPrisma.business.findUnique.mockResolvedValue({ verticalPack: 'aesthetic' });
      mockPrisma.customer.findFirst.mockResolvedValue(null);

      await expect(
        service.upload(businessId, { customerId: 'c1', type: 'BEFORE' as any, bodyArea: 'face' }, mockFile),
      ).rejects.toThrow(NotFoundException);
    });

    it('should upload photo for aesthetic business', async () => {
      mockPrisma.business.findUnique.mockResolvedValue({ verticalPack: 'aesthetic' });
      mockPrisma.customer.findFirst.mockResolvedValue({ id: 'c1', businessId });
      const createdPhoto = { id: 'p1', type: 'BEFORE', bodyArea: 'face', fileUrl: '/api/v1/clinical-photos/file/clinical-test.jpg' };
      mockPrisma.clinicalPhoto.create.mockResolvedValue(createdPhoto);

      const result = await service.upload(
        businessId,
        { customerId: 'c1', type: 'BEFORE' as any, bodyArea: 'face', notes: 'Test' },
        mockFile,
        'staff-1',
      );

      expect(result).toEqual(createdPhoto);
      expect(mockPrisma.clinicalPhoto.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            businessId,
            customerId: 'c1',
            type: 'BEFORE',
            bodyArea: 'face',
            notes: 'Test',
            takenById: 'staff-1',
          }),
        }),
      );
      expect(fs.promises.writeFile).toHaveBeenCalledTimes(2); // main + thumbnail
    });

    it('should validate booking if provided', async () => {
      mockPrisma.business.findUnique.mockResolvedValue({ verticalPack: 'aesthetic' });
      mockPrisma.customer.findFirst.mockResolvedValue({ id: 'c1', businessId });
      mockPrisma.booking.findFirst.mockResolvedValue(null);

      await expect(
        service.upload(
          businessId,
          { customerId: 'c1', type: 'AFTER' as any, bodyArea: 'lips', bookingId: 'nonexistent' },
          mockFile,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('list', () => {
    it('should list photos for customer', async () => {
      const photos = [
        { id: 'p1', type: 'BEFORE', bodyArea: 'face' },
        { id: 'p2', type: 'AFTER', bodyArea: 'face' },
      ];
      mockPrisma.clinicalPhoto.findMany.mockResolvedValue(photos);

      const result = await service.list(businessId, 'c1');
      expect(result).toEqual(photos);
      expect(mockPrisma.clinicalPhoto.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ businessId, customerId: 'c1', deletedAt: null }),
        }),
      );
    });

    it('should filter by type and bodyArea', async () => {
      mockPrisma.clinicalPhoto.findMany.mockResolvedValue([]);

      await service.list(businessId, 'c1', { type: 'BEFORE', bodyArea: 'lips' });
      expect(mockPrisma.clinicalPhoto.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'BEFORE', bodyArea: 'lips' }),
        }),
      );
    });

    it('should filter by date range', async () => {
      mockPrisma.clinicalPhoto.findMany.mockResolvedValue([]);

      await service.list(businessId, 'c1', { from: '2026-01-01', to: '2026-03-01' });
      expect(mockPrisma.clinicalPhoto.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            takenAt: {
              gte: new Date('2026-01-01'),
              lte: new Date('2026-03-01'),
            },
          }),
        }),
      );
    });
  });

  describe('findById', () => {
    it('should return photo if found', async () => {
      const photo = { id: 'p1', businessId, type: 'BEFORE' };
      mockPrisma.clinicalPhoto.findFirst.mockResolvedValue(photo);

      const result = await service.findById(businessId, 'p1');
      expect(result).toEqual(photo);
    });

    it('should throw if not found', async () => {
      mockPrisma.clinicalPhoto.findFirst.mockResolvedValue(null);

      await expect(service.findById(businessId, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDelete', () => {
    it('should soft delete a photo', async () => {
      mockPrisma.clinicalPhoto.findFirst.mockResolvedValue({ id: 'p1', businessId });
      mockPrisma.clinicalPhoto.update.mockResolvedValue({ id: 'p1', deletedAt: new Date() });

      const result = await service.softDelete(businessId, 'p1');
      expect(result.deletedAt).toBeDefined();
      expect(mockPrisma.clinicalPhoto.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should throw if photo not found', async () => {
      mockPrisma.clinicalPhoto.findFirst.mockResolvedValue(null);

      await expect(service.softDelete(businessId, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createComparison', () => {
    it('should create comparison with valid photos', async () => {
      const before = { id: 'p1', businessId, customerId: 'c1', type: 'BEFORE' };
      const after = { id: 'p2', businessId, customerId: 'c1', type: 'AFTER' };
      mockPrisma.clinicalPhoto.findFirst
        .mockResolvedValueOnce(before)
        .mockResolvedValueOnce(after);

      const comparison = { id: 'comp1', beforePhotoId: 'p1', afterPhotoId: 'p2' };
      mockPrisma.photoComparison.create.mockResolvedValue(comparison);

      const result = await service.createComparison(businessId, {
        customerId: 'c1',
        beforePhotoId: 'p1',
        afterPhotoId: 'p2',
        bodyArea: 'face',
      });

      expect(result).toEqual(comparison);
    });

    it('should throw if before photo not found', async () => {
      mockPrisma.clinicalPhoto.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'p2' });

      await expect(
        service.createComparison(businessId, {
          customerId: 'c1',
          beforePhotoId: 'p1',
          afterPhotoId: 'p2',
          bodyArea: 'face',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw if photos belong to different customers', async () => {
      mockPrisma.clinicalPhoto.findFirst
        .mockResolvedValueOnce({ id: 'p1', customerId: 'c1' })
        .mockResolvedValueOnce({ id: 'p2', customerId: 'c2' });

      await expect(
        service.createComparison(businessId, {
          customerId: 'c1',
          beforePhotoId: 'p1',
          afterPhotoId: 'p2',
          bodyArea: 'face',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('listComparisons', () => {
    it('should list comparisons for customer', async () => {
      const comparisons = [{ id: 'comp1' }];
      mockPrisma.photoComparison.findMany.mockResolvedValue(comparisons);

      const result = await service.listComparisons(businessId, 'c1');
      expect(result).toEqual(comparisons);
    });
  });

  describe('getPhotoCountForCustomer', () => {
    it('should return count', async () => {
      mockPrisma.clinicalPhoto.count.mockResolvedValue(5);
      const result = await service.getPhotoCountForCustomer(businessId, 'c1');
      expect(result).toBe(5);
    });
  });

  describe('getBeforePhotosForCustomerBodyArea', () => {
    it('should return before photos for body area', async () => {
      const photos = [{ id: 'p1', type: 'BEFORE', bodyArea: 'face' }];
      mockPrisma.clinicalPhoto.findMany.mockResolvedValue(photos);

      const result = await service.getBeforePhotosForCustomerBodyArea(businessId, 'c1', 'face');
      expect(result).toEqual(photos);
      expect(mockPrisma.clinicalPhoto.findMany).toHaveBeenCalledWith({
        where: {
          businessId,
          customerId: 'c1',
          bodyArea: 'face',
          type: 'BEFORE',
          deletedAt: null,
        },
      });
    });
  });
});
