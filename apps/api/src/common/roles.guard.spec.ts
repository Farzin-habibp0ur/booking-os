import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard, ROLES_KEY, ALLOW_ANY_ROLE_KEY } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  function createMockContext(user: any): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => ({ name: 'testHandler' }),
      getClass: () => ({ name: 'TestController' }),
    } as unknown as ExecutionContext;
  }

  function mockMetadata(roles: string[] | undefined, allowAnyRole?: boolean) {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === ROLES_KEY) return roles;
      if (key === ALLOW_ANY_ROLE_KEY) return allowAnyRole;
      return undefined;
    });
  }

  it('denies access when no roles or AllowAnyRole declared (default-deny)', () => {
    mockMetadata(undefined, undefined);
    const context = createMockContext({ role: 'AGENT' });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('denies access when roles array is empty and no AllowAnyRole', () => {
    mockMetadata([], undefined);
    const context = createMockContext({ role: 'AGENT' });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows access when @AllowAnyRole is set', () => {
    mockMetadata(undefined, true);
    const context = createMockContext({ role: 'AGENT' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows access when @AllowAnyRole is set regardless of user role', () => {
    mockMetadata(undefined, true);
    const context = createMockContext({ role: 'SERVICE_PROVIDER' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('enforces @Roles even when @AllowAnyRole is also set', () => {
    mockMetadata(['ADMIN'], true);
    const context = createMockContext({ role: 'AGENT' });
    expect(guard.canActivate(context)).toBe(false);
  });

  it('allows access when user role matches required roles', () => {
    mockMetadata(['ADMIN']);
    const context = createMockContext({ role: 'ADMIN' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('denies access when user role does not match', () => {
    mockMetadata(['ADMIN']);
    const context = createMockContext({ role: 'AGENT' });
    expect(guard.canActivate(context)).toBe(false);
  });

  it('denies access when user is undefined', () => {
    mockMetadata(['ADMIN']);
    const context = createMockContext(undefined);
    expect(guard.canActivate(context)).toBe(false);
  });

  it('denies access when user has no role', () => {
    mockMetadata(['ADMIN']);
    const context = createMockContext({ email: 'test@test.com' });
    expect(guard.canActivate(context)).toBe(false);
  });

  it('allows access when user is SERVICE_PROVIDER and role is listed', () => {
    mockMetadata(['ADMIN', 'SERVICE_PROVIDER']);
    const context = createMockContext({ role: 'SERVICE_PROVIDER' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('checks correct metadata keys', () => {
    mockMetadata(null as any);
    const context = createMockContext({ role: 'ADMIN' });

    try {
      guard.canActivate(context);
    } catch {
      // expected ForbiddenException
    }

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      expect.anything(),
      expect.anything(),
    ]);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ALLOW_ANY_ROLE_KEY, [
      expect.anything(),
      expect.anything(),
    ]);
  });
});
