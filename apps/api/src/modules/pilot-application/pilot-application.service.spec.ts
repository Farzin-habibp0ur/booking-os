import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { EmailService } from '../email/email.service';
import { PilotApplicationService } from './pilot-application.service';

describe('PilotApplicationService', () => {
  let service: PilotApplicationService;
  let prisma: any;
  let email: any;
  let config: any;

  beforeEach(async () => {
    prisma = {
      pilotApplication: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };
    email = {
      send: jest.fn().mockResolvedValue(true),
      buildBrandedHtml: jest.fn((html: string) => html),
    };
    config = {
      get: jest.fn((key: string) =>
        key === 'PILOT_APPLICATION_NOTIFY_EMAIL' ? 'founder@example.com' : undefined,
      ),
    };

    const module = await Test.createTestingModule({
      providers: [
        PilotApplicationService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: email },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get(PilotApplicationService);
  });

  const dto = {
    clinicName: 'Glow Clinic',
    contactName: 'Sarah Owner',
    email: 'SARAH@EXAMPLE.COM',
    phone: '+15555555555',
    websiteOrInstagram: '@glow',
    countryTimezone: 'Canada / Pacific',
    monthlyLeadVolume: '50_150',
    currentChannels: ['INSTAGRAM', 'WHATSAPP'],
    biggestFrontDeskPain: 'Instagram leads are missed after hours.',
    consent: true,
    startedAt: new Date(Date.now() - 5000).toISOString(),
  };

  it('creates a pilot application and notifies the configured recipient', async () => {
    prisma.pilotApplication.create.mockResolvedValue({
      id: 'pa1',
      ...dto,
      email: 'sarah@example.com',
    });

    const result = await service.create(dto, {
      referrer: 'https://example.com',
      userAgent: 'UnitTest',
    });

    expect(result.message).toContain('2 business days');
    expect(prisma.pilotApplication.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clinicName: 'Glow Clinic',
        email: 'sarah@example.com',
        currentChannels: ['INSTAGRAM', 'WHATSAPP'],
        referrer: 'https://example.com',
        userAgent: 'UnitTest',
      }),
    });
    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'founder@example.com',
        subject: 'New pilot application: Glow Clinic',
      }),
    );
  });

  it('silently accepts honeypot submissions without creating records', async () => {
    const result = await service.create({ ...dto, company: 'Bot Co' }, {});

    expect(result.message).toContain('2 business days');
    expect(prisma.pilotApplication.create).not.toHaveBeenCalled();
  });

  it('silently accepts submissions that arrive too quickly', async () => {
    const result = await service.create({ ...dto, startedAt: new Date().toISOString() }, {});

    expect(result.message).toContain('2 business days');
    expect(prisma.pilotApplication.create).not.toHaveBeenCalled();
  });

  it('returns paginated admin results', async () => {
    prisma.pilotApplication.findMany.mockResolvedValue([{ id: 'pa1' }]);
    prisma.pilotApplication.count.mockResolvedValue(1);

    const result = await service.findAll({ status: 'NEW', search: 'Glow', page: 1, pageSize: 20 });

    expect(result.total).toBe(1);
    expect(prisma.pilotApplication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'NEW' }),
        take: 20,
      }),
    );
  });

  it('updates status timestamps for admin triage', async () => {
    prisma.pilotApplication.findUnique.mockResolvedValue({ id: 'pa1', status: 'NEW' });
    prisma.pilotApplication.update.mockResolvedValue({ id: 'pa1', status: 'CONTACTED' });

    await service.update('pa1', { status: 'CONTACTED', notes: 'Called owner' });

    expect(prisma.pilotApplication.update).toHaveBeenCalledWith({
      where: { id: 'pa1' },
      data: expect.objectContaining({
        status: 'CONTACTED',
        contactedAt: expect.any(Date),
        notes: 'Called owner',
      }),
    });
  });

  it('throws when updating a missing application', async () => {
    prisma.pilotApplication.findUnique.mockResolvedValue(null);

    await expect(service.update('missing', { status: 'REJECTED' })).rejects.toThrow(
      NotFoundException,
    );
  });
});
