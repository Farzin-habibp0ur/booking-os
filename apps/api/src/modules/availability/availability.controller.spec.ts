import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';

describe('AvailabilityController', () => {
  let controller: AvailabilityController;
  let service: Partial<Record<keyof AvailabilityService, jest.Mock>>;

  beforeEach(async () => {
    service = {
      getRecommendedSlots: jest.fn().mockResolvedValue([]),
      getCalendarContext: jest.fn().mockResolvedValue({}),
      getAvailableSlots: jest.fn().mockResolvedValue([]),
    };

    const module = await Test.createTestingModule({
      controllers: [AvailabilityController],
      providers: [{ provide: AvailabilityService, useValue: service }],
    }).compile();

    controller = module.get(AvailabilityController);
  });

  describe('getRecommendedSlots', () => {
    it('returns slots when serviceId and date provided', async () => {
      await controller.getRecommendedSlots('biz1', 'svc1', '2026-02-20');
      expect(service.getRecommendedSlots).toHaveBeenCalledWith(
        'biz1',
        'svc1',
        '2026-02-20',
        undefined,
      );
    });

    it('throws 400 when serviceId is missing', () => {
      expect(() => controller.getRecommendedSlots('biz1', undefined as any, '2026-02-20')).toThrow(
        BadRequestException,
      );
    });

    it('throws 400 when date is missing', () => {
      expect(() => controller.getRecommendedSlots('biz1', 'svc1', undefined as any)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('getCalendarContext', () => {
    it('returns context when dateFrom and dateTo provided', async () => {
      await controller.getCalendarContext('biz1', 'staff1', '2026-02-19', '2026-02-19');
      expect(service.getCalendarContext).toHaveBeenCalledWith(
        'biz1',
        ['staff1'],
        '2026-02-19',
        '2026-02-19',
      );
    });

    it('throws 400 when dateFrom is missing', () => {
      expect(() =>
        controller.getCalendarContext('biz1', 'staff1', undefined as any, '2026-02-19'),
      ).toThrow(BadRequestException);
    });

    it('throws 400 when dateTo is missing', () => {
      expect(() =>
        controller.getCalendarContext('biz1', 'staff1', '2026-02-19', undefined as any),
      ).toThrow(BadRequestException);
    });

    it('handles empty staffIds gracefully', async () => {
      await controller.getCalendarContext('biz1', undefined as any, '2026-02-19', '2026-02-19');
      expect(service.getCalendarContext).toHaveBeenCalledWith(
        'biz1',
        [],
        '2026-02-19',
        '2026-02-19',
      );
    });
  });
});
