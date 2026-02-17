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

  // ────────────────────────────────────────────────────────────
  // findById
  // ────────────────────────────────────────────────────────────
  describe('findById', () => {
    it('returns business when found', async () => {
      const biz = { id: 'biz1', name: 'Glow Clinic' };
      prisma.business.findUnique.mockResolvedValue(biz as any);

      const result = await service.findById('biz1');

      expect(result).toEqual(biz);
      expect(prisma.business.findUnique).toHaveBeenCalledWith({ where: { id: 'biz1' } });
    });

    it('returns null when business does not exist', async () => {
      prisma.business.findUnique.mockResolvedValue(null);

      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ────────────────────────────────────────────────────────────
  // update
  // ────────────────────────────────────────────────────────────
  describe('update', () => {
    it('updates simple fields without packConfig', async () => {
      const updated = { id: 'biz1', name: 'New Name', phone: '555-1234' };
      prisma.business.update.mockResolvedValue(updated as any);

      const result = await service.update('biz1', { name: 'New Name', phone: '555-1234' });

      expect(result).toEqual(updated);
      expect(prisma.business.update).toHaveBeenCalledWith({
        where: { id: 'biz1' },
        data: { name: 'New Name', phone: '555-1234' },
      });
      // Should NOT have called findUnique since there's no packConfig
      expect(prisma.business.findUnique).not.toHaveBeenCalled();
    });

    it('merges packConfig with existing config when packConfig is provided', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        packConfig: { existingKey: 'keep', overrideMe: 'old' },
      } as any);
      prisma.business.update.mockResolvedValue({ id: 'biz1' } as any);

      await service.update('biz1', { packConfig: { overrideMe: 'new', newKey: 'added' } });

      expect(prisma.business.update).toHaveBeenCalledWith({
        where: { id: 'biz1' },
        data: {
          packConfig: { existingKey: 'keep', overrideMe: 'new', newKey: 'added' },
        },
      });
    });

    it('handles packConfig merge when existing packConfig is null', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        packConfig: null,
      } as any);
      prisma.business.update.mockResolvedValue({ id: 'biz1' } as any);

      await service.update('biz1', { packConfig: { newKey: 'value' } });

      expect(prisma.business.update).toHaveBeenCalledWith({
        where: { id: 'biz1' },
        data: {
          packConfig: { newKey: 'value' },
        },
      });
    });

    it('handles packConfig merge when existing packConfig is a non-object (string)', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        packConfig: 'invalid-string',
      } as any);
      prisma.business.update.mockResolvedValue({ id: 'biz1' } as any);

      await service.update('biz1', { packConfig: { key: 'val' } });

      // Non-object packConfig should be treated as empty
      expect(prisma.business.update).toHaveBeenCalledWith({
        where: { id: 'biz1' },
        data: { packConfig: { key: 'val' } },
      });
    });

    it('handles packConfig merge when business is not found', async () => {
      prisma.business.findUnique.mockResolvedValue(null);
      prisma.business.update.mockResolvedValue({ id: 'biz1' } as any);

      await service.update('biz1', { packConfig: { key: 'val' } });

      // Business is null, so packConfig should be { key: 'val' }
      expect(prisma.business.update).toHaveBeenCalledWith({
        where: { id: 'biz1' },
        data: { packConfig: { key: 'val' } },
      });
    });

    it('updates timezone field', async () => {
      prisma.business.update.mockResolvedValue({ id: 'biz1', timezone: 'America/New_York' } as any);

      const result = await service.update('biz1', { timezone: 'America/New_York' });

      expect(result).toEqual({ id: 'biz1', timezone: 'America/New_York' });
      expect(prisma.business.update).toHaveBeenCalledWith({
        where: { id: 'biz1' },
        data: { timezone: 'America/New_York' },
      });
    });

    it('updates verticalPack field', async () => {
      prisma.business.update.mockResolvedValue({ id: 'biz1', verticalPack: 'aesthetic' } as any);

      const result = await service.update('biz1', { verticalPack: 'aesthetic' });

      expect(result).toEqual({ id: 'biz1', verticalPack: 'aesthetic' });
    });
  });

  // ────────────────────────────────────────────────────────────
  // getAiSettings
  // ────────────────────────────────────────────────────────────
  describe('getAiSettings', () => {
    it('returns null when business is not found', async () => {
      prisma.business.findUnique.mockResolvedValue(null);

      const result = await service.getAiSettings('nonexistent');

      expect(result).toBeNull();
    });

    it('returns defaults when aiSettings is null/empty', async () => {
      prisma.business.findUnique.mockResolvedValue({ id: 'biz1', aiSettings: null } as any);

      const result = await service.getAiSettings('biz1');

      expect(result).toEqual({
        enabled: false,
        autoReplySuggestions: true,
        bookingAssistant: true,
        personality: 'friendly and professional',
      });
    });

    it('returns defaults when aiSettings is empty object', async () => {
      prisma.business.findUnique.mockResolvedValue({ id: 'biz1', aiSettings: {} } as any);

      const result = await service.getAiSettings('biz1');

      expect(result).toEqual({
        enabled: false,
        autoReplySuggestions: true,
        bookingAssistant: true,
        personality: 'friendly and professional',
      });
    });

    it('merges stored settings with defaults', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        aiSettings: { enabled: true, personality: 'concise' },
      } as any);

      const result = await service.getAiSettings('biz1');

      expect(result).toEqual({
        enabled: true,
        autoReplySuggestions: true,
        bookingAssistant: true,
        personality: 'concise',
      });
    });

    it('handles non-object aiSettings (falls back to defaults)', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        aiSettings: 'invalid-string',
      } as any);

      const result = await service.getAiSettings('biz1');

      expect(result).toEqual({
        enabled: false,
        autoReplySuggestions: true,
        bookingAssistant: true,
        personality: 'friendly and professional',
      });
    });
  });

  // ────────────────────────────────────────────────────────────
  // updateAiSettings
  // ────────────────────────────────────────────────────────────
  describe('updateAiSettings', () => {
    it('returns null when business is not found', async () => {
      prisma.business.findUnique.mockResolvedValue(null);

      const result = await service.updateAiSettings('nonexistent', { enabled: true });

      expect(result).toBeNull();
      expect(prisma.business.update).not.toHaveBeenCalled();
    });

    it('merges new settings with existing aiSettings', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        aiSettings: { enabled: false, personality: 'friendly' },
      } as any);
      prisma.business.update.mockResolvedValue({ id: 'biz1' } as any);

      await service.updateAiSettings('biz1', { enabled: true, bookingAssistant: false });

      expect(prisma.business.update).toHaveBeenCalledWith({
        where: { id: 'biz1' },
        data: {
          aiSettings: { enabled: true, personality: 'friendly', bookingAssistant: false },
        },
      });
    });

    it('handles null existing aiSettings', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        aiSettings: null,
      } as any);
      prisma.business.update.mockResolvedValue({ id: 'biz1' } as any);

      await service.updateAiSettings('biz1', { enabled: true });

      expect(prisma.business.update).toHaveBeenCalledWith({
        where: { id: 'biz1' },
        data: { aiSettings: { enabled: true } },
      });
    });

    it('handles non-object existing aiSettings (string)', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        aiSettings: 'invalid',
      } as any);
      prisma.business.update.mockResolvedValue({ id: 'biz1' } as any);

      await service.updateAiSettings('biz1', { personality: 'witty' });

      expect(prisma.business.update).toHaveBeenCalledWith({
        where: { id: 'biz1' },
        data: { aiSettings: { personality: 'witty' } },
      });
    });
  });

  // ────────────────────────────────────────────────────────────
  // getNotificationSettings
  // ────────────────────────────────────────────────────────────
  describe('getNotificationSettings', () => {
    it('returns null when business is not found', async () => {
      prisma.business.findUnique.mockResolvedValue(null);

      const result = await service.getNotificationSettings('nonexistent');

      expect(result).toBeNull();
    });

    it('returns defaults when notificationSettings is null', async () => {
      prisma.business.findUnique.mockResolvedValue({ id: 'biz1', notificationSettings: null } as any);

      const result = await service.getNotificationSettings('biz1');

      expect(result).toEqual({
        channels: 'both',
        followUpDelayHours: 2,
        consultFollowUpDays: 3,
        treatmentCheckInHours: 24,
      });
    });

    it('returns defaults when notificationSettings is empty object', async () => {
      prisma.business.findUnique.mockResolvedValue({ id: 'biz1', notificationSettings: {} } as any);

      const result = await service.getNotificationSettings('biz1');

      expect(result).toEqual({
        channels: 'both',
        followUpDelayHours: 2,
        consultFollowUpDays: 3,
        treatmentCheckInHours: 24,
      });
    });

    it('merges stored notification settings with defaults', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        notificationSettings: { channels: 'sms', followUpDelayHours: 4 },
      } as any);

      const result = await service.getNotificationSettings('biz1');

      expect(result).toEqual({
        channels: 'sms',
        followUpDelayHours: 4,
        consultFollowUpDays: 3,
        treatmentCheckInHours: 24,
      });
    });

    it('handles non-object notificationSettings (falls back to defaults)', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        notificationSettings: 42,
      } as any);

      const result = await service.getNotificationSettings('biz1');

      expect(result).toEqual({
        channels: 'both',
        followUpDelayHours: 2,
        consultFollowUpDays: 3,
        treatmentCheckInHours: 24,
      });
    });
  });

  // ────────────────────────────────────────────────────────────
  // updateNotificationSettings
  // ────────────────────────────────────────────────────────────
  describe('updateNotificationSettings', () => {
    it('returns null when business is not found', async () => {
      prisma.business.findUnique.mockResolvedValue(null);

      const result = await service.updateNotificationSettings('nonexistent', { channels: 'email' });

      expect(result).toBeNull();
      expect(prisma.business.update).not.toHaveBeenCalled();
    });

    it('merges new settings with existing notificationSettings', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        notificationSettings: { channels: 'both', followUpDelayHours: 2 },
      } as any);
      prisma.business.update.mockResolvedValue({ id: 'biz1' } as any);

      await service.updateNotificationSettings('biz1', { channels: 'sms', treatmentCheckInHours: 48 });

      expect(prisma.business.update).toHaveBeenCalledWith({
        where: { id: 'biz1' },
        data: {
          notificationSettings: { channels: 'sms', followUpDelayHours: 2, treatmentCheckInHours: 48 },
        },
      });
    });

    it('handles null existing notificationSettings', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        notificationSettings: null,
      } as any);
      prisma.business.update.mockResolvedValue({ id: 'biz1' } as any);

      await service.updateNotificationSettings('biz1', { channels: 'email' });

      expect(prisma.business.update).toHaveBeenCalledWith({
        where: { id: 'biz1' },
        data: { notificationSettings: { channels: 'email' } },
      });
    });

    it('handles non-object existing notificationSettings (number)', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        notificationSettings: 123,
      } as any);
      prisma.business.update.mockResolvedValue({ id: 'biz1' } as any);

      await service.updateNotificationSettings('biz1', { followUpDelayHours: 6 });

      expect(prisma.business.update).toHaveBeenCalledWith({
        where: { id: 'biz1' },
        data: { notificationSettings: { followUpDelayHours: 6 } },
      });
    });
  });

  // ────────────────────────────────────────────────────────────
  // getPolicySettings (existing tests + new branches)
  // ────────────────────────────────────────────────────────────
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

    it('returns defaults when policySettings is null', async () => {
      prisma.business.findUnique.mockResolvedValue({ id: 'biz1', policySettings: null } as any);

      const result = await service.getPolicySettings('biz1');

      expect(result).toEqual({
        cancellationWindowHours: 24,
        rescheduleWindowHours: 24,
        cancellationPolicyText: '',
        reschedulePolicyText: '',
        policyEnabled: false,
      });
    });

    it('handles non-object policySettings (falls back to defaults)', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        policySettings: 'not-an-object',
      } as any);

      const result = await service.getPolicySettings('biz1');

      expect(result).toEqual({
        cancellationWindowHours: 24,
        rescheduleWindowHours: 24,
        cancellationPolicyText: '',
        reschedulePolicyText: '',
        policyEnabled: false,
      });
    });

    it('overrides all defaults when fully specified', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        policySettings: {
          cancellationWindowHours: 12,
          rescheduleWindowHours: 12,
          cancellationPolicyText: 'No cancellations',
          reschedulePolicyText: 'Reschedule 12 hours ahead',
          policyEnabled: true,
        },
      } as any);

      const result = await service.getPolicySettings('biz1');

      expect(result).toEqual({
        cancellationWindowHours: 12,
        rescheduleWindowHours: 12,
        cancellationPolicyText: 'No cancellations',
        reschedulePolicyText: 'Reschedule 12 hours ahead',
        policyEnabled: true,
      });
    });
  });

  // ────────────────────────────────────────────────────────────
  // updatePolicySettings (existing tests + new branches)
  // ────────────────────────────────────────────────────────────
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

    it('handles null existing policySettings', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        policySettings: null,
      } as any);
      prisma.business.update.mockResolvedValue({ id: 'biz1' } as any);

      await service.updatePolicySettings('biz1', { cancellationPolicyText: 'New policy' });

      expect(prisma.business.update).toHaveBeenCalledWith({
        where: { id: 'biz1' },
        data: { policySettings: { cancellationPolicyText: 'New policy' } },
      });
    });

    it('handles non-object existing policySettings (boolean)', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        policySettings: true,
      } as any);
      prisma.business.update.mockResolvedValue({ id: 'biz1' } as any);

      await service.updatePolicySettings('biz1', { policyEnabled: true });

      expect(prisma.business.update).toHaveBeenCalledWith({
        where: { id: 'biz1' },
        data: { policySettings: { policyEnabled: true } },
      });
    });

    it('returns updated business from prisma', async () => {
      const updatedBiz = { id: 'biz1', policySettings: { policyEnabled: true } };
      prisma.business.findUnique.mockResolvedValue({ id: 'biz1', policySettings: {} } as any);
      prisma.business.update.mockResolvedValue(updatedBiz as any);

      const result = await service.updatePolicySettings('biz1', { policyEnabled: true });

      expect(result).toEqual(updatedBiz);
    });
  });

  // ────────────────────────────────────────────────────────────
  // getWaitlistSettings
  // ────────────────────────────────────────────────────────────
  describe('getWaitlistSettings', () => {
    it('returns null when business is not found', async () => {
      prisma.business.findUnique.mockResolvedValue(null);

      const result = await service.getWaitlistSettings('nonexistent');

      expect(result).toBeNull();
    });

    it('returns defaults when packConfig is null', async () => {
      prisma.business.findUnique.mockResolvedValue({ id: 'biz1', packConfig: null } as any);

      const result = await service.getWaitlistSettings('biz1');

      expect(result).toEqual({
        offerCount: 3,
        expiryMinutes: 15,
        quietStart: '21:00',
        quietEnd: '09:00',
      });
    });

    it('returns defaults when packConfig has no waitlist key', async () => {
      prisma.business.findUnique.mockResolvedValue({ id: 'biz1', packConfig: {} } as any);

      const result = await service.getWaitlistSettings('biz1');

      expect(result).toEqual({
        offerCount: 3,
        expiryMinutes: 15,
        quietStart: '21:00',
        quietEnd: '09:00',
      });
    });

    it('merges stored waitlist settings with defaults', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        packConfig: { waitlist: { offerCount: 5, quietStart: '22:00' } },
      } as any);

      const result = await service.getWaitlistSettings('biz1');

      expect(result).toEqual({
        offerCount: 5,
        expiryMinutes: 15,
        quietStart: '22:00',
        quietEnd: '09:00',
      });
    });

    it('overrides all defaults with fully specified waitlist config', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        packConfig: {
          waitlist: { offerCount: 10, expiryMinutes: 30, quietStart: '23:00', quietEnd: '08:00' },
        },
      } as any);

      const result = await service.getWaitlistSettings('biz1');

      expect(result).toEqual({
        offerCount: 10,
        expiryMinutes: 30,
        quietStart: '23:00',
        quietEnd: '08:00',
      });
    });
  });

  // ────────────────────────────────────────────────────────────
  // updateWaitlistSettings
  // ────────────────────────────────────────────────────────────
  describe('updateWaitlistSettings', () => {
    it('returns null when business is not found', async () => {
      prisma.business.findUnique.mockResolvedValue(null);

      const result = await service.updateWaitlistSettings('nonexistent', { offerCount: 5 });

      expect(result).toBeNull();
      expect(prisma.business.update).not.toHaveBeenCalled();
    });

    it('merges new waitlist settings into packConfig.waitlist', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        packConfig: { waitlist: { offerCount: 3, expiryMinutes: 15 }, otherKey: 'preserved' },
      } as any);
      prisma.business.update.mockResolvedValue({ id: 'biz1' } as any);

      await service.updateWaitlistSettings('biz1', { offerCount: 7, quietStart: '20:00' });

      expect(prisma.business.update).toHaveBeenCalledWith({
        where: { id: 'biz1' },
        data: {
          packConfig: {
            otherKey: 'preserved',
            waitlist: { offerCount: 7, expiryMinutes: 15, quietStart: '20:00' },
          },
        },
      });
    });

    it('creates waitlist section when packConfig has no waitlist', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        packConfig: { someOtherSetting: true },
      } as any);
      prisma.business.update.mockResolvedValue({ id: 'biz1' } as any);

      await service.updateWaitlistSettings('biz1', { expiryMinutes: 30 });

      expect(prisma.business.update).toHaveBeenCalledWith({
        where: { id: 'biz1' },
        data: {
          packConfig: {
            someOtherSetting: true,
            waitlist: { expiryMinutes: 30 },
          },
        },
      });
    });

    it('creates packConfig from scratch when it is null', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        packConfig: null,
      } as any);
      prisma.business.update.mockResolvedValue({ id: 'biz1' } as any);

      await service.updateWaitlistSettings('biz1', { quietEnd: '07:00' });

      expect(prisma.business.update).toHaveBeenCalledWith({
        where: { id: 'biz1' },
        data: {
          packConfig: {
            waitlist: { quietEnd: '07:00' },
          },
        },
      });
    });
  });

  // ────────────────────────────────────────────────────────────
  // installPack (existing tests preserved)
  // ────────────────────────────────────────────────────────────
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
        { name: 'Cancellation Confirmation' },
        { name: 'Reschedule Link' },
        { name: 'Cancel Link' },
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

    it('handles null packConfig on business during install', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: businessId,
        packConfig: null,
      } as any);

      const result = await service.installPack(businessId, 'aesthetic');

      // packConfig merge should still work with null existing config
      expect(prisma.business.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            packConfig: expect.objectContaining({
              requireConsultation: true,
              medicalFormRequired: true,
            }),
          },
        }),
      );
      expect(result.installed.packConfig).toBeDefined();
    });

    it('handles non-object packConfig on business during install', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: businessId,
        packConfig: 'invalid-string',
      } as any);

      const result = await service.installPack(businessId, 'aesthetic');

      // Non-object packConfig is treated as empty
      expect(prisma.business.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            packConfig: expect.objectContaining({
              requireConsultation: true,
              medicalFormRequired: true,
            }),
          },
        }),
      );
      expect(result.installed.packConfig).toBeDefined();
    });

    it('only creates templates that do not already exist (partial overlap)', async () => {
      // Only some templates exist
      prisma.messageTemplate.findMany.mockResolvedValue([
        { name: '24h Reminder' },
        { name: 'Booking Confirmation' },
      ] as any);

      await service.installPack(businessId, 'aesthetic');

      const createManyCall = prisma.messageTemplate.createMany.mock.calls[0]?.[0] as any;
      const templateNames = createManyCall.data.map((t: any) => t.name);
      expect(templateNames).not.toContain('24h Reminder');
      expect(templateNames).not.toContain('Booking Confirmation');
      // Should still contain the rest
      expect(templateNames).toContain('Follow-up');
      expect(templateNames).toContain('Consult Follow-up');
    });

    it('only creates services that do not already exist (partial overlap)', async () => {
      // Only some services exist
      prisma.service.findMany.mockResolvedValue([
        { name: 'Consultation' },
        { name: 'Botox' },
      ] as any);

      await service.installPack(businessId, 'aesthetic');

      const createManyCall = prisma.service.createMany.mock.calls[0]?.[0] as any;
      const serviceNames = createManyCall.data.map((s: any) => s.name);
      expect(serviceNames).not.toContain('Consultation');
      expect(serviceNames).not.toContain('Botox');
      expect(serviceNames).toContain('Dermal Filler');
      expect(serviceNames).toContain('Chemical Peel');
      expect(serviceNames).toContain('Microneedling');
    });

    it('returns the updated business in the result', async () => {
      const updatedBiz = { id: businessId, verticalPack: 'aesthetic', packConfig: { requireConsultation: true } };
      // The last business.update call returns the updatedBusiness
      prisma.business.update.mockResolvedValue(updatedBiz as any);

      const result = await service.installPack(businessId, 'aesthetic');

      expect(result.business).toEqual(updatedBiz);
    });

    it('non-deposit services have empty customFields', async () => {
      await service.installPack(businessId, 'aesthetic');

      const createManyCall = prisma.service.createMany.mock.calls[0]?.[0] as any;
      const dataArr = Array.isArray(createManyCall?.data) ? createManyCall.data : [];
      const consultData = dataArr.find((s: any) => s.name === 'Consultation');
      expect(consultData?.customFields).toEqual({});
    });
  });

  // ────────────────────────────────────────────────────────────
  // createTestBooking (existing tests + new branches)
  // ────────────────────────────────────────────────────────────
  describe('createTestBooking', () => {
    it('creates a test booking with first service and staff member', async () => {
      prisma.service.findFirst.mockResolvedValue({ id: 'svc1', name: 'Botox', durationMins: 60 } as any);
      prisma.staff.findFirst.mockResolvedValue({ id: 'staff1', name: 'Dr. Chen' } as any);
      prisma.customer.findFirst.mockResolvedValue(null);
      prisma.customer.create.mockResolvedValue({ id: 'cust1', name: 'Test Patient', email: 'test@example.com' } as any);
      prisma.booking.create.mockResolvedValue({
        id: 'bk1',
        serviceId: 'svc1',
        staffId: 'staff1',
        customerId: 'cust1',
        status: 'CONFIRMED',
        service: { name: 'Botox' },
        customer: { name: 'Test Patient' },
        staff: { name: 'Dr. Chen' },
      } as any);

      const result = await service.createTestBooking('biz1');

      expect(result.id).toBe('bk1');
      expect(result.status).toBe('CONFIRMED');
      expect(prisma.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            businessId: 'biz1',
            serviceId: 'svc1',
            staffId: 'staff1',
            customerId: 'cust1',
            status: 'CONFIRMED',
          }),
          include: { service: true, customer: true, staff: true },
        }),
      );
    });

    it('reuses existing test customer', async () => {
      prisma.service.findFirst.mockResolvedValue({ id: 'svc1', durationMins: 30 } as any);
      prisma.staff.findFirst.mockResolvedValue({ id: 'staff1' } as any);
      prisma.customer.findFirst.mockResolvedValue({ id: 'existing-cust', name: 'Test Patient', email: 'test@example.com' } as any);
      prisma.booking.create.mockResolvedValue({ id: 'bk1' } as any);

      await service.createTestBooking('biz1');

      expect(prisma.customer.create).not.toHaveBeenCalled();
      expect(prisma.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ customerId: 'existing-cust' }),
        }),
      );
    });

    it('throws BadRequestException when no services exist', async () => {
      prisma.service.findFirst.mockResolvedValue(null);

      await expect(service.createTestBooking('biz1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when no staff exist', async () => {
      prisma.service.findFirst.mockResolvedValue({ id: 'svc1', durationMins: 30 } as any);
      prisma.staff.findFirst.mockResolvedValue(null);

      await expect(service.createTestBooking('biz1')).rejects.toThrow(BadRequestException);
      await expect(service.createTestBooking('biz1')).rejects.toThrow(
        'No staff members found. Add at least one staff member first.',
      );
    });

    it('throws specific message when no active services found', async () => {
      prisma.service.findFirst.mockResolvedValue(null);

      await expect(service.createTestBooking('biz1')).rejects.toThrow(
        'No active services found. Create at least one service first.',
      );
    });

    it('creates customer with correct data when none exists', async () => {
      prisma.service.findFirst.mockResolvedValue({ id: 'svc1', durationMins: 30 } as any);
      prisma.staff.findFirst.mockResolvedValue({ id: 'staff1' } as any);
      prisma.customer.findFirst.mockResolvedValue(null);
      prisma.customer.create.mockResolvedValue({ id: 'new-cust' } as any);
      prisma.booking.create.mockResolvedValue({ id: 'bk1' } as any);

      await service.createTestBooking('biz1');

      expect(prisma.customer.create).toHaveBeenCalledWith({
        data: {
          businessId: 'biz1',
          name: 'Test Patient',
          email: 'test@example.com',
          phone: '+10000000000',
        },
      });
    });

    it('sets booking endTime based on service durationMins', async () => {
      prisma.service.findFirst.mockResolvedValue({ id: 'svc1', durationMins: 45 } as any);
      prisma.staff.findFirst.mockResolvedValue({ id: 'staff1' } as any);
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust1' } as any);
      prisma.booking.create.mockResolvedValue({ id: 'bk1' } as any);

      await service.createTestBooking('biz1');

      const createCall = prisma.booking.create.mock.calls[0][0] as any;
      const startTime = createCall.data.startTime as Date;
      const endTime = createCall.data.endTime as Date;
      const diffMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
      expect(diffMinutes).toBe(45);
    });

    it('uses default 30 min duration when service durationMins is null', async () => {
      prisma.service.findFirst.mockResolvedValue({ id: 'svc1', durationMins: null } as any);
      prisma.staff.findFirst.mockResolvedValue({ id: 'staff1' } as any);
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust1' } as any);
      prisma.booking.create.mockResolvedValue({ id: 'bk1' } as any);

      await service.createTestBooking('biz1');

      const createCall = prisma.booking.create.mock.calls[0][0] as any;
      const startTime = createCall.data.startTime as Date;
      const endTime = createCall.data.endTime as Date;
      const diffMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
      expect(diffMinutes).toBe(30);
    });

    it('looks up test customer by email within business', async () => {
      prisma.service.findFirst.mockResolvedValue({ id: 'svc1', durationMins: 30 } as any);
      prisma.staff.findFirst.mockResolvedValue({ id: 'staff1' } as any);
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust1' } as any);
      prisma.booking.create.mockResolvedValue({ id: 'bk1' } as any);

      await service.createTestBooking('biz1');

      expect(prisma.customer.findFirst).toHaveBeenCalledWith({
        where: { businessId: 'biz1', email: 'test@example.com' },
      });
    });

    it('queries for earliest active service', async () => {
      prisma.service.findFirst.mockResolvedValue({ id: 'svc1', durationMins: 30 } as any);
      prisma.staff.findFirst.mockResolvedValue({ id: 'staff1' } as any);
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust1' } as any);
      prisma.booking.create.mockResolvedValue({ id: 'bk1' } as any);

      await service.createTestBooking('biz1');

      expect(prisma.service.findFirst).toHaveBeenCalledWith({
        where: { businessId: 'biz1', isActive: true },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('queries for earliest staff member', async () => {
      prisma.service.findFirst.mockResolvedValue({ id: 'svc1', durationMins: 30 } as any);
      prisma.staff.findFirst.mockResolvedValue({ id: 'staff1' } as any);
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust1' } as any);
      prisma.booking.create.mockResolvedValue({ id: 'bk1' } as any);

      await service.createTestBooking('biz1');

      expect(prisma.staff.findFirst).toHaveBeenCalledWith({
        where: { businessId: 'biz1' },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('sets booking startTime 2 days in the future at 10:00', async () => {
      prisma.service.findFirst.mockResolvedValue({ id: 'svc1', durationMins: 30 } as any);
      prisma.staff.findFirst.mockResolvedValue({ id: 'staff1' } as any);
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust1' } as any);
      prisma.booking.create.mockResolvedValue({ id: 'bk1' } as any);

      await service.createTestBooking('biz1');

      const createCall = prisma.booking.create.mock.calls[0][0] as any;
      const startTime = createCall.data.startTime as Date;
      expect(startTime.getHours()).toBe(10);
      expect(startTime.getMinutes()).toBe(0);

      const now = new Date();
      const expectedDate = new Date(now);
      expectedDate.setDate(expectedDate.getDate() + 2);
      expect(startTime.getDate()).toBe(expectedDate.getDate());
    });
  });
});
