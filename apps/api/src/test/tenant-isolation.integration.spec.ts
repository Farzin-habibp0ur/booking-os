import request from 'supertest';
import { createIntegrationApp, getAuthToken, IntegrationTestContext } from './integration-setup';
import { BookingController } from '../modules/booking/booking.controller';
import { BookingService } from '../modules/booking/booking.service';
import { CustomerController } from '../modules/customer/customer.controller';
import { CustomerService } from '../modules/customer/customer.service';
import { ServiceController } from '../modules/service/service.controller';
import { ServiceService } from '../modules/service/service.service';
import { JwtStrategy } from '../modules/auth/jwt.strategy';
import { ProfileExtractor } from '../modules/ai/profile-extractor';
import { NotificationService } from '../modules/notification/notification.service';
import { BusinessService } from '../modules/business/business.service';
import { createMockNotificationService, createMockBusinessService } from './mocks';

describe('Tenant Isolation', () => {
  let ctx: IntegrationTestContext;
  let bizAToken: string;
  let bizBToken: string;

  const mockProfileExtractor = {
    extract: jest.fn().mockResolvedValue({}),
  };

  beforeAll(async () => {
    ctx = await createIntegrationApp(
      [],
      [BookingController, CustomerController, ServiceController],
      [
        BookingService,
        CustomerService,
        ServiceService,
        JwtStrategy,
        { provide: ProfileExtractor, useValue: mockProfileExtractor },
        { provide: NotificationService, useValue: createMockNotificationService() },
        { provide: BusinessService, useValue: createMockBusinessService() },
      ],
    );

    bizAToken = getAuthToken(ctx.jwtService, { businessId: 'biz-a', sub: 'staff-a' });
    bizBToken = getAuthToken(ctx.jwtService, { businessId: 'biz-b', sub: 'staff-b' });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('Booking isolation', () => {
    it('should only return bookings for the authenticated business', async () => {
      ctx.prisma.booking.findMany.mockResolvedValue([]);
      ctx.prisma.booking.count.mockResolvedValue(0);

      await request(ctx.app.getHttpServer())
        .get('/api/v1/bookings')
        .set('Authorization', `Bearer ${bizAToken}`)
        .expect(200);

      // Verify the query included businessId filter
      const callArgs = ctx.prisma.booking.findMany.mock.calls[0][0] as any;
      expect(callArgs.where.businessId).toBe('biz-a');
    });

    it('should not allow Business B to access Business A booking by ID', async () => {
      ctx.prisma.booking.findFirst.mockResolvedValue(null);

      await request(ctx.app.getHttpServer())
        .get('/api/v1/bookings/booking-from-biz-a')
        .set('Authorization', `Bearer ${bizBToken}`)
        .expect(200); // Returns null, which is correct tenant-filtered behavior

      const callArgs = ctx.prisma.booking.findFirst.mock.calls[0][0] as any;
      expect(callArgs.where.businessId).toBe('biz-b');
    });
  });

  describe('Customer isolation', () => {
    it('should only return customers for the authenticated business', async () => {
      ctx.prisma.customer.findMany.mockResolvedValue([]);
      ctx.prisma.customer.count.mockResolvedValue(0);

      await request(ctx.app.getHttpServer())
        .get('/api/v1/customers')
        .set('Authorization', `Bearer ${bizAToken}`)
        .expect(200);

      const callArgs = ctx.prisma.customer.findMany.mock.calls[0][0] as any;
      expect(callArgs.where.businessId).toBe('biz-a');
    });

    it('should not allow cross-tenant customer creation', async () => {
      ctx.prisma.customer.create.mockResolvedValue({
        id: 'new-cust',
        businessId: 'biz-a',
        name: 'Test',
        phone: '+1234567890',
        email: null,
        tags: [],
        customFields: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await request(ctx.app.getHttpServer())
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${bizAToken}`)
        .send({ name: 'Test', phone: '+1234567890' })
        .expect(201);

      const callArgs = ctx.prisma.customer.create.mock.calls[0][0] as any;
      expect(callArgs.data.businessId).toBe('biz-a');
    });
  });

  describe('Service isolation', () => {
    it('should only return services for the authenticated business', async () => {
      ctx.prisma.service.findMany.mockResolvedValue([]);

      await request(ctx.app.getHttpServer())
        .get('/api/v1/services')
        .set('Authorization', `Bearer ${bizBToken}`)
        .expect(200);

      const callArgs = ctx.prisma.service.findMany.mock.calls[0][0] as any;
      expect(callArgs.where.businessId).toBe('biz-b');
    });
  });

  describe('Authentication enforcement', () => {
    it('should reject requests without auth token', async () => {
      await request(ctx.app.getHttpServer()).get('/api/v1/bookings').expect(401);
    });

    it('should reject requests with invalid token', async () => {
      await request(ctx.app.getHttpServer())
        .get('/api/v1/bookings')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});
