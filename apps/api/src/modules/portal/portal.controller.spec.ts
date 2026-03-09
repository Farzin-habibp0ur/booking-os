import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { PortalController } from './portal.controller';
import { PortalAuthService } from './portal-auth.service';
import { PortalService } from './portal.service';

describe('PortalController', () => {
  let controller: PortalController;
  let authService: any;
  let portalService: any;

  beforeEach(async () => {
    authService = {
      requestOtp: jest.fn().mockResolvedValue({ message: 'Verification code sent' }),
      verifyOtp: jest.fn().mockResolvedValue({ token: 'jwt-token' }),
      requestMagicLink: jest.fn().mockResolvedValue({ message: 'Magic link sent' }),
      verifyMagicLink: jest.fn().mockResolvedValue({ token: 'jwt-token' }),
    };
    portalService = {
      getProfile: jest.fn().mockResolvedValue({ name: 'Jane' }),
      updateProfile: jest.fn().mockResolvedValue({ name: 'Jane Updated' }),
      getBookings: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      getUpcoming: jest.fn().mockResolvedValue([]),
    };

    const module = await Test.createTestingModule({
      controllers: [PortalController],
      providers: [
        { provide: PortalAuthService, useValue: authService },
        { provide: PortalService, useValue: portalService },
        { provide: JwtService, useValue: { verify: jest.fn() } },
      ],
    }).compile();

    controller = module.get(PortalController);
  });

  it('POST /portal/auth/request-otp calls authService.requestOtp', async () => {
    const result = await controller.requestOtp({ slug: 'test', phone: '+1234567890' });
    expect(authService.requestOtp).toHaveBeenCalledWith('test', '+1234567890');
    expect(result.message).toBe('Verification code sent');
  });

  it('POST /portal/auth/verify-otp calls authService.verifyOtp', async () => {
    const result = await controller.verifyOtp({ slug: 'test', phone: '+1234567890', otp: '123456' });
    expect(authService.verifyOtp).toHaveBeenCalledWith('test', '+1234567890', '123456');
    expect(result.token).toBe('jwt-token');
  });

  it('POST /portal/auth/magic-link calls authService.requestMagicLink', async () => {
    const result = await controller.requestMagicLink({ slug: 'test', email: 'test@test.com' });
    expect(authService.requestMagicLink).toHaveBeenCalledWith('test', 'test@test.com');
    expect(result.message).toBe('Magic link sent');
  });

  it('GET /portal/auth/verify-magic-link calls authService.verifyMagicLink', async () => {
    const result = await controller.verifyMagicLink('some-token');
    expect(authService.verifyMagicLink).toHaveBeenCalledWith('some-token');
    expect(result.token).toBe('jwt-token');
  });

  it('GET /portal/me calls portalService.getProfile', async () => {
    const req = { portalUser: { customerId: 'c1', businessId: 'b1' } };
    const result = await controller.getProfile(req);
    expect(portalService.getProfile).toHaveBeenCalledWith('c1', 'b1');
    expect(result.name).toBe('Jane');
  });

  it('PATCH /portal/me calls portalService.updateProfile', async () => {
    const req = { portalUser: { customerId: 'c1', businessId: 'b1' } };
    await controller.updateProfile(req, { name: 'Jane Updated' });
    expect(portalService.updateProfile).toHaveBeenCalledWith('c1', 'b1', { name: 'Jane Updated' });
  });

  it('GET /portal/bookings calls portalService.getBookings', async () => {
    const req = { portalUser: { customerId: 'c1', businessId: 'b1' } };
    await controller.getBookings(req, '2', 'COMPLETED');
    expect(portalService.getBookings).toHaveBeenCalledWith('c1', 'b1', {
      page: 2,
      status: 'COMPLETED',
    });
  });

  it('GET /portal/upcoming calls portalService.getUpcoming', async () => {
    const req = { portalUser: { customerId: 'c1', businessId: 'b1' } };
    await controller.getUpcoming(req);
    expect(portalService.getUpcoming).toHaveBeenCalledWith('c1', 'b1');
  });
});
