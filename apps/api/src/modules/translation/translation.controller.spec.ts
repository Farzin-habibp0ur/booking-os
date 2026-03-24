import { Test } from '@nestjs/testing';
import { TranslationController } from './translation.controller';
import { TranslationService } from './translation.service';

describe('TranslationController', () => {
  let controller: TranslationController;
  let mockService: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockService = {
      getOverrides: jest.fn().mockResolvedValue({ greeting: 'Hello' }),
      getAllKeys: jest.fn().mockResolvedValue([
        { id: 't1', key: 'greeting', value: 'Hello', updatedAt: new Date() },
      ]),
      upsert: jest.fn().mockResolvedValue({
        id: 't1',
        businessId: 'biz1',
        locale: 'es',
        key: 'greeting',
        value: 'Hola',
      }),
      remove: jest.fn().mockResolvedValue({ count: 1 }),
    };

    const module = await Test.createTestingModule({
      controllers: [TranslationController],
      providers: [{ provide: TranslationService, useValue: mockService }],
    }).compile();

    controller = module.get(TranslationController);
  });

  // ─── getOverrides ──────────────────────────────────────────

  describe('getOverrides', () => {
    it('should delegate to service with locale defaulting to en', async () => {
      const result = await controller.getOverrides('biz1', '');

      expect(mockService.getOverrides).toHaveBeenCalledWith('biz1', 'en');
      expect(result).toEqual({ greeting: 'Hello' });
    });

    it('should pass provided locale to service', async () => {
      await controller.getOverrides('biz1', 'es');

      expect(mockService.getOverrides).toHaveBeenCalledWith('biz1', 'es');
    });
  });

  // ─── getAllKeys ─────────────────────────────────────────────

  describe('getAllKeys', () => {
    it('should delegate to service with locale defaulting to en', async () => {
      await controller.getAllKeys('biz1', '');

      expect(mockService.getAllKeys).toHaveBeenCalledWith('biz1', 'en');
    });
  });

  // ─── upsert ────────────────────────────────────────────────

  describe('upsert', () => {
    it('should delegate with correct body fields', async () => {
      const result = await controller.upsert('biz1', {
        locale: 'es',
        key: 'greeting',
        value: 'Hola',
      });

      expect(mockService.upsert).toHaveBeenCalledWith('biz1', 'es', 'greeting', 'Hola');
      expect(result).toHaveProperty('value', 'Hola');
    });
  });

  // ─── remove ────────────────────────────────────────────────

  describe('remove', () => {
    it('should delegate with locale and key params', async () => {
      const result = await controller.remove('biz1', 'es', 'greeting');

      expect(mockService.remove).toHaveBeenCalledWith('biz1', 'es', 'greeting');
      expect(result).toEqual({ count: 1 });
    });
  });
});
