import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { TokenService } from '../../common/token.service';
import { JwtBlacklistService } from '../../common/jwt-blacklist.service';
import { EmailService } from '../email/email.service';
import {
  createIntegrationApp,
  getAuthToken,
  IntegrationTestContext,
} from '../../test/integration-setup';
import { createMockTokenService, createMockEmailService } from '../../test/mocks';
import { BadRequestException } from '@nestjs/common';

jest.mock('bcryptjs');

describe('Auth Integration', () => {
  let ctx: IntegrationTestContext;
  let tokenService: ReturnType<typeof createMockTokenService>;
  let emailService: ReturnType<typeof createMockEmailService>;

  const mockStaff = {
    id: 'staff1',
    name: 'Sarah Johnson',
    email: 'sarah@glowclinic.com',
    passwordHash: '$2b$10$hashed',
    role: 'ADMIN',
    isActive: true,
    businessId: 'biz1',
    locale: 'en',
    business: {
      id: 'biz1',
      name: 'Glow Clinic',
      slug: 'glow-clinic',
      verticalPack: 'AESTHETIC',
      defaultLocale: 'en',
      packConfig: { requireConsultation: true },
    },
  };

  beforeAll(async () => {
    tokenService = createMockTokenService();
    emailService = createMockEmailService();

    ctx = await createIntegrationApp(
      [],
      [AuthController],
      [
        AuthService,
        JwtStrategy,
        JwtBlacklistService,
        { provide: TokenService, useValue: tokenService },
        { provide: EmailService, useValue: emailService },
      ],
    );
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---- Existing login tests ----

  describe('POST /api/v1/auth/login', () => {
    it('returns 201 with tokens on valid credentials', async () => {
      ctx.prisma.staff.findUnique.mockResolvedValue(mockStaff as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'sarah@glowclinic.com', password: 'password123' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.staff.email).toBe('sarah@glowclinic.com');
    });

    it('returns 401 on invalid credentials', async () => {
      ctx.prisma.staff.findUnique.mockResolvedValue(mockStaff as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'sarah@glowclinic.com', password: 'wrong' });

      expect(res.status).toBe(401);
    });

    it('returns 401 for non-existent user', async () => {
      ctx.prisma.staff.findUnique.mockResolvedValue(null);

      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'unknown@test.com', password: 'password' });

      expect(res.status).toBe(401);
    });
  });

  // ---- Existing me/refresh/logout tests ----

  describe('GET /api/v1/auth/me', () => {
    it('returns 200 with staff info when authenticated', async () => {
      ctx.prisma.staff.findUnique.mockResolvedValue(mockStaff as any);
      const token = getAuthToken(ctx.jwtService);

      const res = await request(ctx.app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('staff1');
      expect(res.body.business.name).toBe('Glow Clinic');
      expect(res.body.business.packConfig).toEqual({ requireConsultation: true });
    });

    it('returns 401 without auth token', async () => {
      const res = await request(ctx.app.getHttpServer()).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
    });

    it('returns 401 with invalid token', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('returns new tokens on valid refresh token', async () => {
      ctx.prisma.staff.findUnique.mockResolvedValue(mockStaff as any);
      const refreshToken = ctx.jwtService.sign(
        { sub: 'staff1', email: 'sarah@glowclinic.com', businessId: 'biz1', role: 'ADMIN' },
        { expiresIn: '7d' },
      );

      // H3: refresh token now comes from httpOnly cookie only
      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', `refresh_token=${refreshToken}`);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
    });

    it('returns 201 with message when no refresh token cookie', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/refresh');

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('No refresh token provided');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('returns 201 with ok: true when authenticated', async () => {
      const token = getAuthToken(ctx.jwtService);

      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
    });

    it('returns 401 without auth token', async () => {
      const res = await request(ctx.app.getHttpServer()).post('/api/v1/auth/logout');

      expect(res.status).toBe(401);
    });
  });

  // ---- New signup tests ----

  describe('POST /api/v1/auth/signup', () => {
    it('returns 201 with tokens on successful signup', async () => {
      ctx.prisma.staff.findUnique.mockResolvedValue(null);
      ctx.prisma.business.create.mockResolvedValue({
        id: 'biz-new',
        name: 'New Biz',
        slug: 'new-biz',
      } as any);
      ctx.prisma.staff.create.mockResolvedValue({
        id: 'staff-new',
        name: 'Jane',
        email: 'jane@new.com',
        role: 'ADMIN',
        businessId: 'biz-new',
      } as any);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');

      const res = await request(ctx.app.getHttpServer()).post('/api/v1/auth/signup').send({
        businessName: 'New Biz',
        ownerName: 'Jane',
        email: 'jane@new.com',
        password: 'Password123abc',
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.staff.email).toBe('jane@new.com');
    });

    it('returns 409 for duplicate email', async () => {
      ctx.prisma.staff.findUnique.mockResolvedValue(mockStaff as any);

      const res = await request(ctx.app.getHttpServer()).post('/api/v1/auth/signup').send({
        businessName: 'New',
        ownerName: 'Jane',
        email: 'sarah@glowclinic.com',
        password: 'Password123abc',
      });

      expect(res.status).toBe(409);
    });

    it('returns 400 for validation errors (missing fields)', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send({ email: 'bad' });

      expect(res.status).toBe(400);
    });

    it('returns 400 for password too short', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send({ businessName: 'Biz', ownerName: 'Jane', email: 'jane@new.com', password: 'Short1' });

      expect(res.status).toBe(400);
    });
  });

  // ---- New forgot-password tests ----

  describe('POST /api/v1/auth/forgot-password', () => {
    it('returns 201 with {ok:true}', async () => {
      ctx.prisma.staff.findUnique.mockResolvedValue(mockStaff as any);

      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'sarah@glowclinic.com' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ ok: true });
    });

    it('returns 201 with {ok:true} even for non-existent email', async () => {
      ctx.prisma.staff.findUnique.mockResolvedValue(null);

      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nobody@test.com' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ ok: true });
    });
  });

  // ---- New reset-password tests ----

  describe('POST /api/v1/auth/reset-password', () => {
    it('returns 201 on valid token', async () => {
      tokenService.validateToken.mockResolvedValue({ id: 'token1', staffId: 'staff1' } as any);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');
      ctx.prisma.staff.update.mockResolvedValue({} as any);

      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send({ token: 'valid-token-hex', newPassword: 'NewPassword123' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ ok: true });
    });

    it('returns 400 on invalid token', async () => {
      tokenService.validateToken.mockRejectedValue(new BadRequestException('Invalid token'));

      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send({ token: 'bad-token', newPassword: 'NewPassword123' });

      expect(res.status).toBe(400);
    });
  });

  // ---- New change-password tests ----

  describe('POST /api/v1/auth/change-password', () => {
    it('returns 201 when authenticated with correct current password', async () => {
      ctx.prisma.staff.findUnique.mockResolvedValue(mockStaff as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');
      ctx.prisma.staff.update.mockResolvedValue({} as any);
      const token = getAuthToken(ctx.jwtService);

      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'password123', newPassword: 'NewPassword123' });

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
    });

    it('returns 401 without auth token', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/change-password')
        .send({ currentPassword: 'password123', newPassword: 'NewPassword123' });

      expect(res.status).toBe(401);
    });

    it('returns 400 on wrong current password', async () => {
      ctx.prisma.staff.findUnique.mockResolvedValue(mockStaff as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      const token = getAuthToken(ctx.jwtService);

      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'wrongpassword', newPassword: 'NewPassword123' });

      expect(res.status).toBe(400);
    });
  });

  // ---- New accept-invite tests ----

  describe('POST /api/v1/auth/accept-invite', () => {
    it('returns 201 with tokens on valid invite', async () => {
      tokenService.validateToken.mockResolvedValue({ id: 'token1', staffId: 'staff1' } as any);
      ctx.prisma.staff.findUnique.mockResolvedValue({ ...mockStaff, passwordHash: null } as any);
      (bcrypt.hash as jest.Mock).mockResolvedValue('invite-hash');
      ctx.prisma.staff.update.mockResolvedValue({
        id: 'staff1',
        name: 'Sarah Johnson',
        email: 'sarah@glowclinic.com',
        role: 'ADMIN',
        businessId: 'biz1',
        isActive: true,
      } as any);

      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/accept-invite')
        .send({ token: 'invite-token-hex', password: 'MyPassword123x' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.staff.id).toBe('staff1');
    });

    it('returns 400 on invalid token', async () => {
      tokenService.validateToken.mockRejectedValue(new BadRequestException('Invalid token'));

      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/accept-invite')
        .send({ token: 'bad-token', password: 'MyPassword123x' });

      expect(res.status).toBe(400);
    });
  });

  // M16: Email verification integration tests
  describe('POST /api/v1/auth/verify-email', () => {
    it('returns 201 on valid token', async () => {
      tokenService.validateToken.mockResolvedValue({ id: 'token1', staffId: 'staff1' } as any);
      ctx.prisma.staff.update.mockResolvedValue({} as any);

      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .send({ token: 'valid-verify-token' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ ok: true });
    });

    it('returns 400 on invalid token', async () => {
      tokenService.validateToken.mockRejectedValue(new BadRequestException('Invalid token'));

      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .send({ token: 'bad-token' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when token field is missing', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/resend-verification', () => {
    it('returns 201 when authenticated and email not verified', async () => {
      ctx.prisma.staff.findUnique.mockResolvedValue({
        ...mockStaff,
        emailVerified: false,
      } as any);
      const token = getAuthToken(ctx.jwtService);

      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/resend-verification')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ ok: true });
    });

    it('returns 401 without auth token', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/resend-verification');

      expect(res.status).toBe(401);
    });

    it('returns 400 if already verified', async () => {
      ctx.prisma.staff.findUnique.mockResolvedValue({
        ...mockStaff,
        emailVerified: true,
      } as any);
      const token = getAuthToken(ctx.jwtService);

      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/resend-verification')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });
  });
});
