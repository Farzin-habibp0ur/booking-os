import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PortalGuard } from './portal-auth.guard';

describe('PortalGuard', () => {
  let guard: PortalGuard;
  let jwtService: { verify: jest.Mock };

  const createMockContext = (headers: Record<string, string> = {}): ExecutionContext => {
    const request = { headers };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    jwtService = {
      verify: jest.fn().mockReturnValue({
        customerId: 'cust1',
        businessId: 'biz1',
        type: 'portal',
      }),
    };
    guard = new PortalGuard(jwtService as any);
  });

  it('passes for valid portal JWT', () => {
    const ctx = createMockContext({ authorization: 'Bearer valid-token' });
    expect(guard.canActivate(ctx)).toBe(true);

    const req = ctx.switchToHttp().getRequest() as any;
    expect(req.portalUser).toEqual({
      customerId: 'cust1',
      businessId: 'biz1',
    });
  });

  it('rejects missing Authorization header', () => {
    const ctx = createMockContext({});
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('rejects non-Bearer token', () => {
    const ctx = createMockContext({ authorization: 'Basic abc' });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('rejects expired JWT', () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error('jwt expired');
    });
    const ctx = createMockContext({ authorization: 'Bearer expired-token' });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('rejects staff JWT (wrong type)', () => {
    jwtService.verify.mockReturnValue({
      sub: 'staff1',
      businessId: 'biz1',
      role: 'ADMIN',
      type: undefined,
    });
    const ctx = createMockContext({ authorization: 'Bearer staff-token' });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('rejects token with missing customerId', () => {
    jwtService.verify.mockReturnValue({
      businessId: 'biz1',
      type: 'portal',
    });
    const ctx = createMockContext({ authorization: 'Bearer incomplete-token' });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });
});
