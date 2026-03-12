import { Test, TestingModule } from '@nestjs/testing';
import { ClinicalPhotoController } from './clinical-photo.controller';
import { ClinicalPhotoService } from './clinical-photo.service';
import { BadRequestException } from '@nestjs/common';

describe('ClinicalPhotoController', () => {
  let controller: ClinicalPhotoController;
  let service: any;

  const mockService = {
    upload: jest.fn(),
    list: jest.fn(),
    findById: jest.fn(),
    softDelete: jest.fn(),
    createComparison: jest.fn(),
    listComparisons: jest.fn(),
    getFilePath: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClinicalPhotoController],
      providers: [{ provide: ClinicalPhotoService, useValue: mockService }],
    }).compile();

    controller = module.get<ClinicalPhotoController>(ClinicalPhotoController);
    service = module.get<ClinicalPhotoService>(ClinicalPhotoService);
  });

  describe('POST /clinical-photos', () => {
    it('should throw if no file provided', async () => {
      await expect(
        controller.upload(
          'biz-1',
          null as any,
          { customerId: 'c1', type: 'BEFORE', bodyArea: 'face' },
          { user: { staffId: 's1' } },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if required fields missing', async () => {
      const file = {
        buffer: Buffer.from(''),
        mimetype: 'image/jpeg',
        size: 1024,
        originalname: 'test.jpg',
      };
      await expect(
        controller.upload('biz-1', file as any, { customerId: 'c1' }, { user: { staffId: 's1' } }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should call service.upload', async () => {
      const file = {
        buffer: Buffer.from(''),
        mimetype: 'image/jpeg',
        size: 1024,
        originalname: 'test.jpg',
      };
      const photo = { id: 'p1' };
      mockService.upload.mockResolvedValue(photo);

      const result = await controller.upload(
        'biz-1',
        file as any,
        { customerId: 'c1', type: 'BEFORE', bodyArea: 'face' },
        { user: { staffId: 's1' } },
      );

      expect(result).toEqual(photo);
      expect(mockService.upload).toHaveBeenCalledWith(
        'biz-1',
        expect.objectContaining({ customerId: 'c1', type: 'BEFORE', bodyArea: 'face' }),
        expect.objectContaining({ buffer: expect.any(Buffer), mimetype: 'image/jpeg' }),
        's1',
      );
    });
  });

  describe('GET /clinical-photos', () => {
    it('should throw if no customerId', async () => {
      await expect(controller.list('biz-1', '')).rejects.toThrow(BadRequestException);
    });

    it('should return photos', async () => {
      const photos = [{ id: 'p1' }];
      mockService.list.mockResolvedValue(photos);

      const result = await controller.list('biz-1', 'c1', 'BEFORE', 'face');
      expect(result).toEqual(photos);
      expect(mockService.list).toHaveBeenCalledWith('biz-1', 'c1', {
        type: 'BEFORE',
        bodyArea: 'face',
        from: undefined,
        to: undefined,
      });
    });
  });

  describe('GET /clinical-photos/:id', () => {
    it('should return photo', async () => {
      const photo = { id: 'p1' };
      mockService.findById.mockResolvedValue(photo);

      const result = await controller.findById('biz-1', 'p1');
      expect(result).toEqual(photo);
    });
  });

  describe('DELETE /clinical-photos/:id', () => {
    it('should soft delete', async () => {
      mockService.softDelete.mockResolvedValue({ id: 'p1', deletedAt: new Date() });

      const result = await controller.delete('biz-1', 'p1');
      expect(result.deletedAt).toBeDefined();
    });
  });

  describe('POST /clinical-photos/compare', () => {
    it('should create comparison', async () => {
      const comparison = { id: 'comp1' };
      mockService.createComparison.mockResolvedValue(comparison);

      const result = await controller.createComparison('biz-1', {
        customerId: 'c1',
        beforePhotoId: 'p1',
        afterPhotoId: 'p2',
        bodyArea: 'face',
      });

      expect(result).toEqual(comparison);
    });
  });

  describe('GET /clinical-photos/comparisons', () => {
    it('should throw if no customerId', async () => {
      await expect(controller.listComparisons('biz-1', '')).rejects.toThrow(BadRequestException);
    });

    it('should return comparisons', async () => {
      const comparisons = [{ id: 'comp1' }];
      mockService.listComparisons.mockResolvedValue(comparisons);

      const result = await controller.listComparisons('biz-1', 'c1');
      expect(result).toEqual(comparisons);
    });
  });
});
