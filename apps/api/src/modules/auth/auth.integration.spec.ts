import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { createIntegrationApp, getAuthToken, IntegrationTestContext } from '../../test/integration-setup';

jest.mock('bcryptjs');

describe('Auth Integration', () => {
  let ctx: IntegrationTestContext;

  const mockStaff = {
    id: 'staff1',
    name: 'Sarah Johnson',
    email: 'sarah@glowclinic.com',
    passwordHash: '$2b$10$hashed',
    role: 'OWNER',
    isActive: true,
    businessId: 'biz1',
    locale: 'en',
    business: {
      id: 'biz1',
      name: 'Glow Clinic',
      slug: 'glow-clinic',
      verticalPack: 'AESTHETIC',
      defaultLocale: 'en',
    },
  };

  beforeAll(async () => {
    ctx = await createIntegrationApp(
      [],
      [AuthController],
      [AuthService, JwtStrategy],
    );
  });

  afterAll(async () => {
    await ctx.app.close();
  });

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
    });

    it('returns 401 without auth token', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/api/v1/auth/me');

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
        { sub: 'staff1', email: 'sarah@glowclinic.com', businessId: 'biz1', role: 'OWNER' },
        { expiresIn: '7d' },
      );

      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
    });

    it('returns 401 on invalid refresh token', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(res.status).toBe(401);
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
      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/logout');

      expect(res.status).toBe(401);
    });
  });
});
