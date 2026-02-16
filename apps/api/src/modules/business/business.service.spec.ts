import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { BusinessService } from './business.service';
import { PrismaService } from '../../common/prisma.service';
import { VerticalPackService } from '../vertical-pack/vertical-pack.service';
import { createMockPrisma } from '../../test/mocks';

describe('BusinessService', () => {
  let service: BusinessService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let verticalPackService: VerticalPackService;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      providers: [
        BusinessService,
        VerticalPackService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(BusinessService);
    verticalPackService = module.get(VerticalPackService);
  });

  describe('getPolicySettings', () => {
    it('returns defaults when business has empty policySettings', async () => {
      prisma.business.findUnique.mockResolvedValue({ id: 'biz1', policySettings: {} } as any);

      const result = await service.getPolicySettings('biz1');

      expect(result).toEqual({
        cancellationWindowHours: 24,
        rescheduleWindowHours: 24,
        cancellationPolicyText: '',
        reschedulePolicyText: '',
        policyEnabled: false,
      });
    });

    it('merges stored settings with defaults', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        policySettings: { policyEnabled: true, cancellationWindowHours: 48 },
      } as any);

      const result = await service.getPolicySettings('biz1');

      expect(result).toEqual({
        cancellationWindowHours: 48,
        rescheduleWindowHours: 24,
        cancellationPolicyText: '',
        reschedulePolicyText: '',
        policyEnabled: true,
      });
    });

    it('returns null when business not found', async () => {
      prisma.business.findUnique.mockResolvedValue(null);

      const result = await service.getPolicySettings('biz-nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updatePolicySettings', () => {
    it('merges new settings with existing', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        policySettings: { policyEnabled: false, cancellationWindowHours: 24 },
      } as any);
      prisma.business.update.mockResolvedValue({ id: 'biz1' } as any);

      await service.updatePolicySettings('biz1', { policyEnabled: true, rescheduleWindowHours: 48 });

      expect(prisma.business.update).toHaveBeenCalledWith({
        where: { id: 'biz1' },
        data: {
          policySettings: {
            policyEnabled: true,
            cancellationWindowHours: 24,
            rescheduleWindowHours: 48,
          },
        },
      });
    });

    it('returns null when business not found', async () => {
      prisma.business.findUnique.mockResolvedValue(null);

      const result = await service.updatePolicySettings('biz-nonexistent', { policyEnabled: true });

      expect(result).toBeNull();
    });
  });

  describe('installPack', () => {
    const businessId = 'biz1';

    beforeEach(() => {
      // Default mocks for a clean business with no existing data
      prisma.business.update.mockResolvedValue({ id: businessId, verticalPack: 'aesthetic' } as any);
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      prisma.messageTemplate.createMany.mockResolvedValue({ count: 7 });
      prisma.service.findMany.mockResolvedValue([]);
      prisma.service.createMany.mockResolvedValue({ count: 5 });
      prisma.business.findUnique.mockResolvedValue({ id: businessId, packConfig: {} } as any);
      prisma.messageTemplate.count.mockResolvedValue(7);
      prisma.service.count.mockResolvedValue(5);
    });

    it('installs aesthetic pack: creates 7 templates, 5 services, sets notification settings and packConfig', async () => {
      const result = await service.installPack(businessId, 'aesthetic');

      // Sets verticalPack
      expect(prisma.business.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: businessId },
          data: { verticalPack: 'aesthetic' },
        }),
      );

      // Creates templates
      expect(prisma.messageTemplate.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ businessId, name: '24h Reminder', category: 'REMINDER' }),
            expect.objectContaining({ businessId, name: 'Booking Confirmation', category: 'CONFIRMATION' }),
            expect.objectContaining({ businessId, name: 'Follow-up', category: 'FOLLOW_UP' }),
            expect.objectContaining({ businessId, name: 'Consult Follow-up', category: 'CONSULT_FOLLOW_UP' }),
            expect.objectContaining({ businessId, name: 'Aftercare Instructions', category: 'AFTERCARE' }),
            expect.objectContaining({ businessId, name: 'Treatment Check-in', category: 'TREATMENT_CHECK_IN' }),
            expect.objectContaining({ businessId, name: 'Deposit Request', category: 'DEPOSIT_REQUIRED' }),
          ]),
        }),
      );

      // Creates services
      expect(prisma.service.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ businessId, name: 'Consultation', kind: 'CONSULT' }),
            expect.objectContaining({ businessId, name: 'Botox', kind: 'TREATMENT' }),
            expect.objectContaining({ businessId, name: 'Dermal Filler', kind: 'TREATMENT' }),
            expect.objectContaining({ businessId, name: 'Chemical Peel', kind: 'TREATMENT' }),
            expect.objectContaining({ businessId, name: 'Microneedling', kind: 'TREATMENT' }),
          ]),
        }),
      );

      // Sets notification settings
      expect(prisma.business.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: businessId },
          data: {
            notificationSettings: {
              channels: 'both',
              followUpDelayHours: 2,
              consultFollowUpDays: 3,
              treatmentCheckInHours: 24,
            },
          },
        }),
      );

      // Sets packConfig with requiredProfileFields
      expect(prisma.business.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: businessId },
          data: {
            packConfig: expect.objectContaining({
              requireConsultation: true,
              medicalFormRequired: true,
              requiredProfileFields: ['firstName', 'email'],
            }),
          },
        }),
      );

      // Returns summary
      expect(result.installed.templates).toBe(7);
      expect(result.installed.services).toBe(5);
      expect(result.installed.notificationSettings).toBe(true);
    });

    it('skips template and service creation if they already exist', async () => {
      // Simulate existing templates and services
      prisma.messageTemplate.findMany.mockResolvedValue([
        { name: '24h Reminder' },
        { name: 'Booking Confirmation' },
        { name: 'Follow-up' },
        { name: 'Consult Follow-up' },
        { name: 'Aftercare Instructions' },
        { name: 'Treatment Check-in' },
        { name: 'Deposit Request' },
      ] as any);
      prisma.service.findMany.mockResolvedValue([
        { name: 'Consultation' },
        { name: 'Botox' },
        { name: 'Dermal Filler' },
        { name: 'Chemical Peel' },
        { name: 'Microneedling' },
      ] as any);

      await service.installPack(businessId, 'aesthetic');

      // Should NOT create any templates or services
      expect(prisma.messageTemplate.createMany).not.toHaveBeenCalled();
      expect(prisma.service.createMany).not.toHaveBeenCalled();
    });

    it('installs general pack with minimal defaults', async () => {
      prisma.messageTemplate.count.mockResolvedValue(2);
      prisma.service.count.mockResolvedValue(1);
      prisma.service.createMany.mockResolvedValue({ count: 1 });
      prisma.messageTemplate.createMany.mockResolvedValue({ count: 2 });

      const result = await service.installPack(businessId, 'general');

      // Sets verticalPack to general
      expect(prisma.business.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: businessId },
          data: { verticalPack: 'general' },
        }),
      );

      // Creates 2 templates (reminder + confirmation)
      expect(prisma.messageTemplate.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ businessId, name: '24h Reminder', category: 'REMINDER' }),
            expect.objectContaining({ businessId, name: 'Booking Confirmation', category: 'CONFIRMATION' }),
          ]),
        }),
      );

      // Creates 1 service
      expect(prisma.service.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ businessId, name: 'General Appointment', kind: 'OTHER' }),
          ]),
        }),
      );

      expect(result.installed.templates).toBe(2);
      expect(result.installed.services).toBe(1);
    });

    it('throws BadRequestException for unknown pack', async () => {
      await expect(service.installPack(businessId, 'unknown')).rejects.toThrow(BadRequestException);
    });

    it('Botox service includes deposit fields in customFields', async () => {
      await service.installPack(businessId, 'aesthetic');

      const createManyCall = prisma.service.createMany.mock.calls[0]?.[0] as any;
      const dataArr = Array.isArray(createManyCall?.data) ? createManyCall.data : [];
      const botoxData = dataArr.find((s: any) => s.name === 'Botox');
      expect(botoxData?.customFields).toEqual({ depositRequired: true, depositAmount: 50 });
    });

    it('merges packConfig with existing config', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: businessId,
        packConfig: { existingKey: 'value' },
      } as any);

      await service.installPack(businessId, 'aesthetic');

      expect(prisma.business.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            packConfig: expect.objectContaining({
              existingKey: 'value',
              requireConsultation: true,
              medicalFormRequired: true,
              requiredProfileFields: ['firstName', 'email'],
            }),
          },
        }),
      );
    });
  });
});
