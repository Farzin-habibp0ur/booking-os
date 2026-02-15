import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  function createMockContext(user: any): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
  }

  it('allows access when no roles required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = createMockContext({ role: 'AGENT' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows access when roles array is empty', () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    const context = createMockContext({ role: 'AGENT' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows access when user role matches', () => {
    reflector.getAllAndOverride.mockReturnValue(['OWNER', 'ADMIN']);
    const context = createMockContext({ role: 'OWNER' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('denies access when user role does not match', () => {
    reflector.getAllAndOverride.mockReturnValue(['OWNER', 'ADMIN']);
    const context = createMockContext({ role: 'AGENT' });
    expect(guard.canActivate(context)).toBe(false);
  });

  it('denies access when user is undefined', () => {
    reflector.getAllAndOverride.mockReturnValue(['OWNER']);
    const context = createMockContext(undefined);
    expect(guard.canActivate(context)).toBe(false);
  });

  it('denies access when user has no role', () => {
    reflector.getAllAndOverride.mockReturnValue(['OWNER']);
    const context = createMockContext({ email: 'test@test.com' });
    expect(guard.canActivate(context)).toBe(false);
  });

  it('checks correct metadata key', () => {
    reflector.getAllAndOverride.mockReturnValue(null);
    const context = createMockContext({ role: 'OWNER' });

    guard.canActivate(context);

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      'roles',
      [expect.any(Function), expect.any(Function)],
    );
  });
});
