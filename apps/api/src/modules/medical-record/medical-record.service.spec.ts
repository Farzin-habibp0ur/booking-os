import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MedicalRecordService } from './medical-record.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('MedicalRecordService', () => {
  let service: MedicalRecordService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      providers: [MedicalRecordService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(MedicalRecordService);
  });

  describe('create', () => {
    it('should create a new v1 record when no existing record and auto-set flagged based on allergies', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust1', businessId: 'biz1' } as any);
      prisma.medicalRecord.findFirst.mockResolvedValue(null);

      const created = {
        id: 'mr1',
        businessId: 'biz1',
        customerId: 'cust1',
        version: 1,
        isCurrent: true,
        flagged: true,
        flagReason: 'Allergies: Penicillin',
        allergies: ['Penicillin'],
      };

      prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
      prisma.medicalRecord.create.mockResolvedValue(created as any);

      const result = await service.create('biz1', {
        customerId: 'cust1',
        allergies: ['Penicillin'],
      });

      expect(result.id).toBe('mr1');
      expect(result.version).toBe(1);
      expect(result.flagged).toBe(true);
      expect(prisma.medicalRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            version: 1,
            isCurrent: true,
            flagged: true,
            flagReason: 'Allergies: Penicillin',
          }),
        }),
      );
    });

    it('should increment version and mark previous as not current', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust1', businessId: 'biz1' } as any);
      prisma.medicalRecord.findFirst.mockResolvedValue({
        id: 'mr1',
        version: 2,
        isCurrent: true,
      } as any);

      const created = {
        id: 'mr2',
        version: 3,
        isCurrent: true,
        flagged: false,
      };

      prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
      prisma.medicalRecord.update.mockResolvedValue({} as any);
      prisma.medicalRecord.create.mockResolvedValue(created as any);

      const result = await service.create('biz1', {
        customerId: 'cust1',
      });

      expect(result.version).toBe(3);
      expect(prisma.medicalRecord.update).toHaveBeenCalledWith({
        where: { id: 'mr1' },
        data: { isCurrent: false },
      });
      expect(prisma.medicalRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ version: 3, isCurrent: true }),
        }),
      );
    });

    it('should auto-detect flag for bloodThinners=true', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust1', businessId: 'biz1' } as any);
      prisma.medicalRecord.findFirst.mockResolvedValue(null);

      prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
      prisma.medicalRecord.create.mockResolvedValue({
        id: 'mr1',
        flagged: true,
        flagReason: 'Blood thinners',
      } as any);

      await service.create('biz1', {
        customerId: 'cust1',
        bloodThinners: true,
      });

      expect(prisma.medicalRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            flagged: true,
            flagReason: 'Blood thinners',
          }),
        }),
      );
    });

    it('should set consentDate when consentGiven=true', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust1', businessId: 'biz1' } as any);
      prisma.medicalRecord.findFirst.mockResolvedValue(null);

      prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
      prisma.medicalRecord.create.mockResolvedValue({
        id: 'mr1',
        consentGiven: true,
        consentDate: new Date(),
      } as any);

      await service.create('biz1', {
        customerId: 'cust1',
        consentGiven: true,
      });

      expect(prisma.medicalRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            consentGiven: true,
            consentDate: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('getCurrent', () => {
    it('should return current record', async () => {
      const record = {
        id: 'mr1',
        customerId: 'cust1',
        businessId: 'biz1',
        isCurrent: true,
        version: 1,
        recordedBy: { name: 'Dr. Smith' },
      };
      prisma.medicalRecord.findFirst.mockResolvedValue(record as any);

      const result = await service.getCurrent('biz1', 'cust1');

      expect(result).toEqual(record);
      expect(prisma.medicalRecord.findFirst).toHaveBeenCalledWith({
        where: { customerId: 'cust1', businessId: 'biz1', isCurrent: true },
        include: { recordedBy: { select: { name: true } } },
      });
    });

    it('should return null when no record exists', async () => {
      prisma.medicalRecord.findFirst.mockResolvedValue(null);

      const result = await service.getCurrent('biz1', 'cust1');

      expect(result).toBeNull();
    });
  });

  describe('getHistory', () => {
    it('should return all versions ordered by version desc', async () => {
      const record = { id: 'mr1', customerId: 'cust1', businessId: 'biz1' };
      prisma.medicalRecord.findFirst.mockResolvedValue(record as any);

      const history = [
        { id: 'mr2', version: 2, recordedBy: { name: 'Dr. Smith' } },
        { id: 'mr1', version: 1, recordedBy: { name: 'Dr. Smith' } },
      ];
      prisma.medicalRecord.findMany.mockResolvedValue(history as any);

      const result = await service.getHistory('biz1', 'mr1');

      expect(result).toHaveLength(2);
      expect(result[0].version).toBe(2);
      expect(prisma.medicalRecord.findMany).toHaveBeenCalledWith({
        where: { customerId: 'cust1' },
        orderBy: { version: 'desc' },
        include: { recordedBy: { select: { name: true } } },
      });
    });

    it('should throw NotFoundException for invalid id', async () => {
      prisma.medicalRecord.findFirst.mockResolvedValue(null);

      await expect(service.getHistory('biz1', 'invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('checkMedicalClearance', () => {
    it('should return correct status when record exists and is flagged', async () => {
      prisma.medicalRecord.findFirst.mockResolvedValue({
        id: 'mr1',
        flagged: true,
        flagReason: 'Allergies: Penicillin',
      } as any);

      const result = await service.checkMedicalClearance('biz1', 'cust1');

      expect(result).toEqual({
        hasMedicalRecord: true,
        flagged: true,
        flagReason: 'Allergies: Penicillin',
      });
    });

    it('should return correct status when no record exists', async () => {
      prisma.medicalRecord.findFirst.mockResolvedValue(null);

      const result = await service.checkMedicalClearance('biz1', 'cust1');

      expect(result).toEqual({
        hasMedicalRecord: false,
        flagged: false,
        flagReason: null,
      });
    });
  });
});
