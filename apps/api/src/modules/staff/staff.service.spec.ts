import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { StaffService } from './staff.service';
import { PrismaService } from '../../common/prisma.service';
import { TokenService } from '../../common/token.service';
import { EmailService } from '../email/email.service';
import {
  createMockPrisma,
  createMockConfigService,
  createMockTokenService,
  createMockEmailService,
} from '../../test/mocks';

jest.mock('bcryptjs');

describe('StaffService', () => {
  let staffService: StaffService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let tokenService: ReturnType<typeof createMockTokenService>;
  let emailService: ReturnType<typeof createMockEmailService>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    tokenService = createMockTokenService();
    emailService = createMockEmailService();

    const module = await Test.createTestingModule({
      providers: [
        StaffService,
        { provide: PrismaService, useValue: prisma },
        { provide: TokenService, useValue: tokenService },
        { provide: EmailService, useValue: emailService },
        { provide: ConfigService, useValue: createMockConfigService() },
      ],
    }).compile();

    staffService = module.get(StaffService);
  });

  describe('findAll', () => {
    it('returns staff with invitePending flag, omits passwordHash', async () => {
      const staffList = [
        {
          id: 's1',
          name: 'Alice',
          email: 'a@b.com',
          role: 'ADMIN',
          isActive: true,
          passwordHash: 'hashed',
          createdAt: new Date(),
        },
        {
          id: 's2',
          name: 'Bob',
          email: 'b@b.com',
          role: 'AGENT',
          isActive: true,
          passwordHash: null,
          createdAt: new Date(),
        },
      ];
      prisma.staff.findMany.mockResolvedValue(staffList as any);

      const result = await staffService.findAll('biz1');

      expect(result).toHaveLength(2);
      expect(result[0].invitePending).toBe(false);
      expect((result[0] as any).passwordHash).toBeUndefined();
      expect(result[1].invitePending).toBe(true);
      expect((result[1] as any).passwordHash).toBeUndefined();
    });
  });

  describe('create', () => {
    it('creates staff with hashed password', async () => {
      prisma.staff.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-pw');
      prisma.staff.create.mockResolvedValue({
        id: 's1',
        name: 'Alice',
        email: 'a@b.com',
        role: 'AGENT',
        isActive: true,
        createdAt: new Date(),
      } as any);

      const result = await staffService.create('biz1', {
        name: 'Alice',
        email: 'a@b.com',
        password: 'password123',
        role: 'AGENT',
      });

      expect(result.id).toBe('s1');
      expect(prisma.staff.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            businessId: 'biz1',
            email: 'a@b.com',
            passwordHash: 'hashed-pw',
          }),
        }),
      );
    });

    it('throws ConflictException for duplicate email', async () => {
      prisma.staff.findUnique.mockResolvedValue({ id: 's1' } as any);

      await expect(
        staffService.create('biz1', {
          name: 'Alice',
          email: 'a@b.com',
          password: 'pw',
          role: 'AGENT',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('inviteStaff', () => {
    it('creates staff without password, creates token, sends email', async () => {
      prisma.staff.findUnique.mockResolvedValue(null);
      prisma.business.findUnique.mockResolvedValue({ id: 'biz1', name: 'Glow Clinic' } as any);
      prisma.staff.create.mockResolvedValue({
        id: 's1',
        name: 'Bob',
        email: 'bob@test.com',
        role: 'AGENT',
        isActive: true,
        createdAt: new Date(),
      } as any);
      tokenService.createToken.mockResolvedValue('invite-token-hex');

      const result = await staffService.inviteStaff('biz1', { email: 'bob@test.com', name: 'Bob' });

      expect(result.invitePending).toBe(true);
      expect(prisma.staff.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            businessId: 'biz1',
            email: 'bob@test.com',
            role: 'AGENT',
          }),
        }),
      );
      // Should NOT have passwordHash in create data
      const createData = prisma.staff.create.mock.calls[0][0].data;
      expect(createData.passwordHash).toBeUndefined();

      expect(tokenService.createToken).toHaveBeenCalledWith(
        'STAFF_INVITE',
        'bob@test.com',
        'biz1',
        's1',
        48,
      );
      expect(emailService.sendStaffInvitation).toHaveBeenCalledWith(
        'bob@test.com',
        expect.objectContaining({ name: 'Bob', businessName: 'Glow Clinic' }),
      );
    });

    it('throws ConflictException for duplicate email', async () => {
      prisma.staff.findUnique.mockResolvedValue({ id: 's1' } as any);

      await expect(
        staffService.inviteStaff('biz1', { email: 'existing@test.com', name: 'Bob' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('resendInvite', () => {
    it('revokes old tokens, creates new, sends email', async () => {
      prisma.staff.findFirst.mockResolvedValue({
        id: 's1',
        name: 'Bob',
        email: 'bob@test.com',
        passwordHash: null,
        businessId: 'biz1',
        business: { id: 'biz1', name: 'Glow Clinic' },
      } as any);
      tokenService.createToken.mockResolvedValue('new-token-hex');

      const result = await staffService.resendInvite('biz1', 's1');

      expect(result).toEqual({ ok: true });
      expect(tokenService.revokeTokens).toHaveBeenCalledWith('bob@test.com', 'STAFF_INVITE');
      expect(tokenService.createToken).toHaveBeenCalledWith(
        'STAFF_INVITE',
        'bob@test.com',
        'biz1',
        's1',
        48,
      );
      expect(emailService.sendStaffInvitation).toHaveBeenCalled();
    });

    it('throws ConflictException if password already set', async () => {
      prisma.staff.findFirst.mockResolvedValue({
        id: 's1',
        name: 'Bob',
        email: 'bob@test.com',
        passwordHash: 'already-set',
        business: { id: 'biz1', name: 'Glow Clinic' },
      } as any);

      await expect(staffService.resendInvite('biz1', 's1')).rejects.toThrow(ConflictException);
    });
  });

  describe('revokeInvite', () => {
    it('revokes tokens and deactivates staff', async () => {
      prisma.staff.findFirst.mockResolvedValue({ id: 's1', email: 'bob@test.com' } as any);
      prisma.staff.update.mockResolvedValue({} as any);

      const result = await staffService.revokeInvite('biz1', 's1');

      expect(result).toEqual({ ok: true });
      expect(tokenService.revokeTokens).toHaveBeenCalledWith('bob@test.com', 'STAFF_INVITE');
      expect(prisma.staff.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { isActive: false },
      });
    });

    it('throws NotFoundException if not found', async () => {
      prisma.staff.findFirst.mockResolvedValue(null);

      await expect(staffService.revokeInvite('biz1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
