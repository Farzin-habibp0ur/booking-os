import { Test } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlanGuard } from './plan.guard';
import { PrismaService } from './prisma.service';
import { createMockPrisma } from '../test/mocks';

function createMockContext(
  businessId: string,
  method = 'GET',
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        user: { businessId },
        method,
      }),
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

describe('PlanGuard', () => {
  let guard: PlanGuard;
  let reflector: Reflector;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    reflector = new Reflector();

    const module = await Test.createTestingModule({
      providers: [
        PlanGuard,
        { provide: PrismaService, useValue: prisma },
        { provide: Reflector, useValue: reflector },
      ],
    }).compile();

    guard = module.get(PlanGuard);
  });

  test('allows access when no plan or feature requirement', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const result = await guard.canActivate(createMockContext('biz1'));
    expect(result).toBe(true);
  });

  test('allows access during active trial', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(undefined) // requiredPlan
      .mockReturnValueOnce('campaigns'); // requiredFeature

    prisma.business.findUnique.mockResolvedValue({
      id: 'biz1',
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      graceEndsAt: null,
      subscription: null,
    } as any);

    const result = await guard.canActivate(createMockContext('biz1'));
    expect(result).toBe(true);
  });

  test('allows read access during grace period', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce('campaigns');

    prisma.business.findUnique.mockResolvedValue({
      id: 'biz1',
      trialEndsAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      graceEndsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
      subscription: null,
    } as any);

    const result = await guard.canActivate(createMockContext('biz1', 'GET'));
    expect(result).toBe(true);
  });

  test('blocks write access during grace period', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce('campaigns');

    prisma.business.findUnique.mockResolvedValue({
      id: 'biz1',
      trialEndsAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      graceEndsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      subscription: null,
    } as any);

    await expect(guard.canActivate(createMockContext('biz1', 'POST'))).rejects.toThrow(
      ForbiddenException,
    );
  });

  test('allows access when subscription has the feature', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce('campaigns');

    prisma.business.findUnique.mockResolvedValue({
      id: 'biz1',
      trialEndsAt: null,
      graceEndsAt: null,
      subscription: {
        plan: 'professional',
        status: 'active',
      },
    } as any);

    const result = await guard.canActivate(createMockContext('biz1'));
    expect(result).toBe(true);
  });

  test('blocks access when plan lacks the feature', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce('campaigns');

    prisma.business.findUnique.mockResolvedValue({
      id: 'biz1',
      trialEndsAt: null,
      graceEndsAt: null,
      subscription: {
        plan: 'starter',
        status: 'active',
      },
    } as any);

    await expect(guard.canActivate(createMockContext('biz1'))).rejects.toThrow(ForbiddenException);
  });

  test('blocks access when tier is below required', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce('enterprise') // requiredPlan
      .mockReturnValueOnce(undefined); // requiredFeature

    prisma.business.findUnique.mockResolvedValue({
      id: 'biz1',
      trialEndsAt: null,
      graceEndsAt: null,
      subscription: {
        plan: 'professional',
        status: 'active',
      },
    } as any);

    await expect(guard.canActivate(createMockContext('biz1'))).rejects.toThrow(ForbiddenException);
  });

  test('allows access when tier meets requirement', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce('professional')
      .mockReturnValueOnce(undefined);

    prisma.business.findUnique.mockResolvedValue({
      id: 'biz1',
      trialEndsAt: null,
      graceEndsAt: null,
      subscription: {
        plan: 'enterprise',
        status: 'active',
      },
    } as any);

    const result = await guard.canActivate(createMockContext('biz1'));
    expect(result).toBe(true);
  });

  test('requires subscription when no trial or grace period', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce('campaigns');

    prisma.business.findUnique.mockResolvedValue({
      id: 'biz1',
      trialEndsAt: null,
      graceEndsAt: null,
      subscription: null,
    } as any);

    await expect(guard.canActivate(createMockContext('biz1'))).rejects.toThrow(ForbiddenException);
  });

  test('normalizes legacy plan names', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce('campaigns');

    prisma.business.findUnique.mockResolvedValue({
      id: 'biz1',
      trialEndsAt: null,
      graceEndsAt: null,
      subscription: {
        plan: 'pro', // legacy name
        status: 'active',
      },
    } as any);

    const result = await guard.canActivate(createMockContext('biz1'));
    expect(result).toBe(true);
  });

  test('ForbiddenException includes upgrade_required error details', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce('whatsappInbox');

    prisma.business.findUnique.mockResolvedValue({
      id: 'biz1',
      trialEndsAt: null,
      graceEndsAt: null,
      subscription: {
        plan: 'starter',
        status: 'active',
      },
    } as any);

    try {
      await guard.canActivate(createMockContext('biz1'));
      fail('Expected ForbiddenException');
    } catch (err: any) {
      const response = err.getResponse();
      expect(response.error).toBe('upgrade_required');
      expect(response.currentPlan).toBe('starter');
      expect(response.requiredPlan).toBe('professional');
      expect(response.feature).toBe('whatsappInbox');
    }
  });
});
