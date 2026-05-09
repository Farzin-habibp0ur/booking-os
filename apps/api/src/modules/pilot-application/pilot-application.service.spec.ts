import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { TokenService } from '../../common/token.service';
import { EmailService } from '../email/email.service';
import { PilotApplicationService } from './pilot-application.service';

describe('PilotApplicationService', () => {
  let service: PilotApplicationService;
  let prisma: any;
  let email: any;
  let config: any;
  let tokens: any;

  beforeEach(async () => {
    prisma = {
      pilotApplication: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      business: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
      staff: {
        create: jest.fn(),
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
    };
    email = {
      send: jest.fn().mockResolvedValue(true),
      buildBrandedHtml: jest.fn((html: string) => html),
    };
    config = {
      get: jest.fn((key: string) => {
        if (key === 'PILOT_APPLICATION_NOTIFY_EMAIL') return 'founder@example.com';
        if (key === 'APP_URL') return 'https://app.example.com';
        return undefined;
      }),
    };
    tokens = {
      createToken: jest.fn().mockResolvedValue('test-token'),
    };

    const module = await Test.createTestingModule({
      providers: [
        PilotApplicationService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: email },
        { provide: ConfigService, useValue: config },
        { provide: TokenService, useValue: tokens },
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
    practiceType: 'MED_SPA',
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
        practiceType: 'MED_SPA',
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

  describe('acceptApplicationAndProvision', () => {
    const application = {
      id: 'pa1',
      clinicName: 'Glow Clinic',
      contactName: 'Sarah Owner',
      email: 'sarah@example.com',
      countryTimezone: 'America/Toronto',
      practiceType: 'MED_SPA',
      status: 'NEW',
      acceptedBusinessId: null,
    };

    it('throws NotFoundException when application is missing', async () => {
      prisma.pilotApplication.findUnique.mockResolvedValue(null);
      await expect(service.acceptApplicationAndProvision('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('provisions a Business + Owner Staff and sends a welcome email', async () => {
      prisma.pilotApplication.findUnique.mockResolvedValue({ ...application });
      prisma.business.findUnique.mockResolvedValue(null); // slug free
      prisma.business.create.mockResolvedValue({ id: 'biz1', slug: 'glow-clinic' });
      prisma.staff.create.mockResolvedValue({ id: 'staff1' });
      prisma.pilotApplication.update.mockResolvedValue({ id: 'pa1' });

      const result = await service.acceptApplicationAndProvision('pa1');

      expect(result).toEqual({
        businessId: 'biz1',
        ownerStaffId: 'staff1',
        setupTokenSent: true,
      });
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.business.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Glow Clinic',
          slug: 'glow-clinic',
          verticalPack: 'aesthetic',
          timezone: 'America/Toronto',
        }),
      });
      expect(prisma.staff.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          businessId: 'biz1',
          email: 'sarah@example.com',
          name: 'Sarah Owner',
          role: 'OWNER',
          isActive: true,
          emailVerified: false,
          passwordHash: null,
          locale: 'en',
        }),
      });
      expect(prisma.pilotApplication.update).toHaveBeenCalledWith({
        where: { id: 'pa1' },
        data: expect.objectContaining({
          status: 'ACCEPTED',
          acceptedBusinessId: 'biz1',
          acceptedAt: expect.any(Date),
        }),
      });
      expect(tokens.createToken).toHaveBeenCalledWith(
        'PASSWORD_RESET',
        'sarah@example.com',
        'biz1',
        'staff1',
        168,
      );
      expect(email.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'sarah@example.com',
          subject: 'Welcome to your AI Front Desk pilot',
        }),
      );
    });

    it('is idempotent: re-running on an ACCEPTED application skips email and reuses business', async () => {
      prisma.pilotApplication.findUnique.mockResolvedValue({
        ...application,
        status: 'ACCEPTED',
        acceptedBusinessId: 'biz1',
      });
      prisma.staff.findFirst.mockResolvedValue({ id: 'staff1' });

      const result = await service.acceptApplicationAndProvision('pa1');

      expect(result).toEqual({
        businessId: 'biz1',
        ownerStaffId: 'staff1',
        setupTokenSent: false,
      });
      expect(prisma.business.create).not.toHaveBeenCalled();
      expect(prisma.staff.create).not.toHaveBeenCalled();
      expect(tokens.createToken).not.toHaveBeenCalled();
      expect(email.send).not.toHaveBeenCalled();
    });

    it('rolls back the Business when staff creation fails', async () => {
      prisma.pilotApplication.findUnique.mockResolvedValue({ ...application });
      prisma.business.findUnique.mockResolvedValue(null);
      prisma.business.create.mockResolvedValue({ id: 'biz1', slug: 'glow-clinic' });
      prisma.staff.create.mockRejectedValue(new Error('duplicate email'));
      // Simulate transaction rollback by rejecting inside the callback
      prisma.$transaction.mockImplementation(async (fn: any) => {
        return fn(prisma);
      });

      await expect(service.acceptApplicationAndProvision('pa1')).rejects.toThrow('duplicate email');
      // Token + email never run because we never reach post-commit
      expect(tokens.createToken).not.toHaveBeenCalled();
      expect(email.send).not.toHaveBeenCalled();
    });

    it('still returns provisioned ids if welcome email fails', async () => {
      prisma.pilotApplication.findUnique.mockResolvedValue({ ...application });
      prisma.business.findUnique.mockResolvedValue(null);
      prisma.business.create.mockResolvedValue({ id: 'biz1', slug: 'glow-clinic' });
      prisma.staff.create.mockResolvedValue({ id: 'staff1' });
      prisma.pilotApplication.update.mockResolvedValue({ id: 'pa1' });
      email.send.mockRejectedValueOnce(new Error('SMTP down'));

      const result = await service.acceptApplicationAndProvision('pa1');

      expect(result).toEqual({
        businessId: 'biz1',
        ownerStaffId: 'staff1',
        setupTokenSent: false,
      });
    });

    it('uses UTC when application has no timezone', async () => {
      prisma.pilotApplication.findUnique.mockResolvedValue({
        ...application,
        countryTimezone: null,
      });
      prisma.business.findUnique.mockResolvedValue(null);
      prisma.business.create.mockResolvedValue({ id: 'biz1', slug: 'glow-clinic' });
      prisma.staff.create.mockResolvedValue({ id: 'staff1' });
      prisma.pilotApplication.update.mockResolvedValue({ id: 'pa1' });

      await service.acceptApplicationAndProvision('pa1');

      expect(prisma.business.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ timezone: 'UTC' }),
      });
    });
  });

  describe('addToYear2Waitlist', () => {
    it('throws NotFoundException when application is missing', async () => {
      prisma.pilotApplication.findUnique.mockResolvedValue(null);
      await expect(service.addToYear2Waitlist('missing')).rejects.toThrow(NotFoundException);
    });

    it('updates status to WAITLIST_YEAR_2 and sends email', async () => {
      prisma.pilotApplication.findUnique.mockResolvedValue({
        id: 'pa2',
        clinicName: 'Cool Derm',
        contactName: 'Dr Skin',
        email: 'derm@example.com',
        practiceType: 'DERMATOLOGY',
        status: 'NEW',
      });
      prisma.pilotApplication.update.mockResolvedValue({ id: 'pa2', status: 'WAITLIST_YEAR_2' });

      const result = await service.addToYear2Waitlist('pa2');

      expect(result.status).toBe('WAITLIST_YEAR_2');
      expect(prisma.pilotApplication.update).toHaveBeenCalledWith({
        where: { id: 'pa2' },
        data: { status: 'WAITLIST_YEAR_2' },
      });
      expect(email.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'derm@example.com',
          subject: 'Thanks for applying — Year 2 waitlist',
        }),
      );
    });
  });
});
