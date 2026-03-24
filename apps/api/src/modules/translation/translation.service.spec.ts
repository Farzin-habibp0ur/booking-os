import { Test } from '@nestjs/testing';
import { TranslationService } from './translation.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma, MockPrisma } from '../../test/mocks';

describe('TranslationService', () => {
  let service: TranslationService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      providers: [TranslationService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(TranslationService);
  });

  // ─── getOverrides ──────────────────────────────────────────

  describe('getOverrides', () => {
    it('should return a key-value map from findMany results', async () => {
      (prisma.translation.findMany as jest.Mock).mockResolvedValue([
        { key: 'greeting', value: 'Hola' },
        { key: 'farewell', value: 'Adiós' },
      ]);

      const result = await service.getOverrides('biz1', 'es');

      expect(result).toEqual({ greeting: 'Hola', farewell: 'Adiós' });
    });

    it('should return empty object when no translations exist', async () => {
      (prisma.translation.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getOverrides('biz1', 'en');

      expect(result).toEqual({});
    });

    it('should filter by businessId and locale', async () => {
      (prisma.translation.findMany as jest.Mock).mockResolvedValue([]);

      await service.getOverrides('biz1', 'es');

      expect(prisma.translation.findMany).toHaveBeenCalledWith({
        where: { businessId: 'biz1', locale: 'es' },
      });
    });
  });

  // ─── getAllKeys ─────────────────────────────────────────────

  describe('getAllKeys', () => {
    it('should return array of { id, key, value, updatedAt }', async () => {
      const now = new Date();
      (prisma.translation.findMany as jest.Mock).mockResolvedValue([
        { id: 't1', key: 'greeting', value: 'Hello', updatedAt: now },
      ]);

      const result = await service.getAllKeys('biz1', 'en');

      expect(result).toEqual([{ id: 't1', key: 'greeting', value: 'Hello', updatedAt: now }]);
    });

    it('should return empty array when no translations exist', async () => {
      (prisma.translation.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getAllKeys('biz1', 'en');

      expect(result).toEqual([]);
    });
  });

  // ─── upsert ────────────────────────────────────────────────

  describe('upsert', () => {
    it('should call prisma.translation.upsert with composite key', async () => {
      const mockTranslation = {
        id: 't1',
        businessId: 'biz1',
        locale: 'es',
        key: 'greeting',
        value: 'Hola',
        updatedAt: new Date(),
      };
      (prisma.translation.upsert as jest.Mock).mockResolvedValue(mockTranslation);

      const result = await service.upsert('biz1', 'es', 'greeting', 'Hola');

      expect(prisma.translation.upsert).toHaveBeenCalledWith({
        where: {
          businessId_locale_key: { businessId: 'biz1', locale: 'es', key: 'greeting' },
        },
        create: { businessId: 'biz1', locale: 'es', key: 'greeting', value: 'Hola' },
        update: { value: 'Hola' },
      });
      expect(result).toEqual(mockTranslation);
    });
  });

  // ─── remove ────────────────────────────────────────────────

  describe('remove', () => {
    it('should call deleteMany with correct where clause', async () => {
      (prisma.translation.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

      const result = await service.remove('biz1', 'es', 'greeting');

      expect(prisma.translation.deleteMany).toHaveBeenCalledWith({
        where: { businessId: 'biz1', locale: 'es', key: 'greeting' },
      });
      expect(result).toEqual({ count: 1 });
    });
  });
});
