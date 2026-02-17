import { Test } from '@nestjs/testing';
import { TemplateService } from './template.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('TemplateService', () => {
  let service: TemplateService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    const module = await Test.createTestingModule({
      providers: [TemplateService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(TemplateService);
  });

  describe('findAll', () => {
    it('returns templates ordered by name', async () => {
      const templates = [
        { id: 't1', name: 'Aftercare' },
        { id: 't2', name: 'Booking' },
      ];
      prisma.messageTemplate.findMany.mockResolvedValue(templates as any);

      const result = await service.findAll('biz1');

      expect(result).toEqual(templates);
      expect(prisma.messageTemplate.findMany).toHaveBeenCalledWith({
        where: { businessId: 'biz1' },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('findById', () => {
    it('returns template scoped to business', async () => {
      const template = { id: 't1', name: 'Aftercare', businessId: 'biz1' };
      prisma.messageTemplate.findFirst.mockResolvedValue(template as any);

      const result = await service.findById('biz1', 't1');

      expect(result).toEqual(template);
      expect(prisma.messageTemplate.findFirst).toHaveBeenCalledWith({
        where: { id: 't1', businessId: 'biz1' },
      });
    });
  });

  describe('create', () => {
    it('creates template with explicit variables', async () => {
      const created = {
        id: 't1',
        name: 'Test',
        body: 'Hello {{customerName}}',
        variables: ['customerName'],
      };
      prisma.messageTemplate.create.mockResolvedValue(created as any);

      const result = await service.create('biz1', {
        name: 'Test',
        category: 'General',
        body: 'Hello {{customerName}}',
        variables: ['customerName'],
      });

      expect(result).toEqual(created);
      expect(prisma.messageTemplate.create).toHaveBeenCalledWith({
        data: {
          businessId: 'biz1',
          name: 'Test',
          category: 'General',
          body: 'Hello {{customerName}}',
          variables: ['customerName'],
        },
      });
    });

    it('auto-extracts variables from body when not provided', async () => {
      prisma.messageTemplate.create.mockResolvedValue({} as any);

      await service.create('biz1', {
        name: 'Test',
        category: 'General',
        body: 'Hi {{customerName}}, your {{serviceName}} is on {{date}}',
      });

      expect(prisma.messageTemplate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          variables: expect.arrayContaining(['customerName', 'serviceName', 'date']),
        }),
      });
    });

    it('deduplicates extracted variables', async () => {
      prisma.messageTemplate.create.mockResolvedValue({} as any);

      await service.create('biz1', {
        name: 'Test',
        category: 'General',
        body: '{{customerName}} and {{customerName}} again',
      });

      expect(prisma.messageTemplate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          variables: ['customerName'],
        }),
      });
    });
  });

  describe('update', () => {
    it('updates template with auto-extracted variables when body changes', async () => {
      prisma.messageTemplate.update.mockResolvedValue({} as any);

      await service.update('biz1', 't1', { body: 'New {{staffName}} text' });

      expect(prisma.messageTemplate.update).toHaveBeenCalledWith({
        where: { id: 't1', businessId: 'biz1' },
        data: expect.objectContaining({
          body: 'New {{staffName}} text',
          variables: ['staffName'],
        }),
      });
    });

    it('does not auto-extract when variables are explicitly provided', async () => {
      prisma.messageTemplate.update.mockResolvedValue({} as any);

      await service.update('biz1', 't1', {
        body: 'Hello {{customerName}}',
        variables: ['customerName', 'extra'],
      });

      expect(prisma.messageTemplate.update).toHaveBeenCalledWith({
        where: { id: 't1', businessId: 'biz1' },
        data: expect.objectContaining({
          variables: ['customerName', 'extra'],
        }),
      });
    });

    it('updates without variable extraction when body is not changed', async () => {
      prisma.messageTemplate.update.mockResolvedValue({} as any);

      await service.update('biz1', 't1', { name: 'Renamed' });

      expect(prisma.messageTemplate.update).toHaveBeenCalledWith({
        where: { id: 't1', businessId: 'biz1' },
        data: { name: 'Renamed' },
      });
    });
  });

  describe('remove', () => {
    it('deletes template by id scoped to business', async () => {
      prisma.messageTemplate.delete.mockResolvedValue({} as any);

      await service.remove('biz1', 't1');

      expect(prisma.messageTemplate.delete).toHaveBeenCalledWith({
        where: { id: 't1', businessId: 'biz1' },
      });
    });
  });

  describe('resolveVariables', () => {
    it('replaces all known variables in template body', async () => {
      const result = await service.resolveVariables(
        {
          body: 'Hi {{customerName}}, your {{serviceName}} is on {{date}} at {{time}} with {{staffName}} at {{businessName}}',
          variables: ['customerName', 'serviceName', 'date', 'time', 'staffName', 'businessName'],
        },
        {
          customerName: 'Emma',
          serviceName: 'Botox',
          date: '2026-03-01',
          time: '10:00',
          staffName: 'Dr. Chen',
          businessName: 'Glow Clinic',
        },
      );

      expect(result).toBe(
        'Hi Emma, your Botox is on 2026-03-01 at 10:00 with Dr. Chen at Glow Clinic',
      );
    });

    it('leaves unresolved variables when context is missing', async () => {
      const result = await service.resolveVariables(
        {
          body: 'Hi {{customerName}}, link: {{bookingLink}}',
          variables: ['customerName', 'bookingLink'],
        },
        { customerName: 'Emma' },
      );

      expect(result).toBe('Hi Emma, link: {{bookingLink}}');
    });

    it('replaces multiple occurrences of same variable', async () => {
      const result = await service.resolveVariables(
        {
          body: '{{customerName}} hello {{customerName}}',
          variables: ['customerName'],
        },
        { customerName: 'Emma' },
      );

      expect(result).toBe('Emma hello Emma');
    });

    it('handles link variables', async () => {
      const result = await service.resolveVariables(
        {
          body: 'Reschedule: {{rescheduleLink}} or cancel: {{cancelLink}}',
          variables: ['rescheduleLink', 'cancelLink'],
        },
        {
          rescheduleLink: 'https://example.com/reschedule/abc',
          cancelLink: 'https://example.com/cancel/def',
        },
      );

      expect(result).toContain('https://example.com/reschedule/abc');
      expect(result).toContain('https://example.com/cancel/def');
    });

    it('handles deposit amount variable', async () => {
      const result = await service.resolveVariables(
        {
          body: 'Deposit required: {{depositAmount}}',
          variables: ['depositAmount'],
        },
        { depositAmount: '$50' },
      );

      expect(result).toBe('Deposit required: $50');
    });
  });
});
