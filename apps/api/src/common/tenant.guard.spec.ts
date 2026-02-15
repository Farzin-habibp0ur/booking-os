import { ExecutionContext } from '@nestjs/common';
import { TenantGuard } from './tenant.guard';

describe('TenantGuard', () => {
  let guard: TenantGuard;

  beforeEach(() => {
    guard = new TenantGuard();
  });

  function createMockContext(user: any): ExecutionContext {
    const request = { user } as any;
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;
  }

  it('allows access when user has businessId', () => {
    const context = createMockContext({ businessId: 'biz1', role: 'OWNER' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('attaches businessId to request', () => {
    const request = { user: { businessId: 'biz1' } } as any;
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;

    guard.canActivate(context);
    expect(request.businessId).toBe('biz1');
  });

  it('denies access when user has no businessId', () => {
    const context = createMockContext({ role: 'OWNER' });
    expect(guard.canActivate(context)).toBe(false);
  });

  it('denies access when user is null', () => {
    const context = createMockContext(null);
    expect(guard.canActivate(context)).toBe(false);
  });

  it('denies access when user is undefined', () => {
    const context = createMockContext(undefined);
    expect(guard.canActivate(context)).toBe(false);
  });

  it('denies access when businessId is empty string', () => {
    const context = createMockContext({ businessId: '' });
    expect(guard.canActivate(context)).toBe(false);
  });
});
