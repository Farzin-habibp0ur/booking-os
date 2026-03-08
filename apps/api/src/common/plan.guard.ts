import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from './prisma.service';
import { PlanTier, normalizePlanTier, getEffectiveLimits, GRACE_PERIOD_DAYS } from './plan-config';

export const REQUIRED_PLAN_KEY = 'requiredPlan';
export const REQUIRED_FEATURE_KEY = 'requiredFeature';

/**
 * Decorator: @RequiresPlan('professional')
 * Restricts endpoint to users on the specified plan tier or higher.
 */
export const RequiresPlan = (plan: PlanTier) => SetMetadata(REQUIRED_PLAN_KEY, plan);

/**
 * Decorator: @RequiresFeature('whatsappInbox')
 * Restricts endpoint to users whose plan includes the named feature.
 */
export const RequiresFeature = (feature: string) => SetMetadata(REQUIRED_FEATURE_KEY, feature);

const TIER_ORDER: Record<PlanTier, number> = {
  starter: 0,
  professional: 1,
  enterprise: 2,
};

@Injectable()
export class PlanGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPlan = this.reflector.getAllAndOverride<PlanTier | undefined>(REQUIRED_PLAN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredFeature = this.reflector.getAllAndOverride<string | undefined>(
      REQUIRED_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no plan or feature requirement, allow
    if (!requiredPlan && !requiredFeature) return true;

    const request = context.switchToHttp().getRequest();
    const businessId = request.user?.businessId;
    if (!businessId) return true; // Let auth guard handle missing auth

    // Fetch business + subscription
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: { subscription: true },
    });

    if (!business) return true;

    // Check trial status
    const now = new Date();
    const isTrial = business.trialEndsAt ? business.trialEndsAt > now : false;

    // During trial, all features are unlocked
    if (isTrial) return true;

    // Check grace period — if trial ended but within grace period, allow read-only
    // (Write operations should be blocked separately)
    const isGracePeriod =
      business.trialEndsAt &&
      business.graceEndsAt &&
      now > business.trialEndsAt &&
      now <= business.graceEndsAt;

    // No subscription and no trial/grace = restrict
    if (!business.subscription && !isGracePeriod) {
      throw new ForbiddenException({
        error: 'subscription_required',
        message: 'A subscription is required to access this feature.',
        requiredPlan: requiredPlan || 'starter',
      });
    }

    // During grace period with no subscription, block write operations
    if (isGracePeriod && !business.subscription) {
      const method = request.method;
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        throw new ForbiddenException({
          error: 'trial_expired',
          message: 'Your trial has ended. Upgrade to continue creating and editing.',
          requiredPlan: 'starter',
        });
      }
      return true; // Allow reads during grace
    }

    const subscription = business.subscription;
    if (!subscription) return true;

    const userPlan = normalizePlanTier(subscription.plan);
    const limits = getEffectiveLimits(userPlan, false);

    // Check tier requirement
    if (requiredPlan && TIER_ORDER[userPlan] < TIER_ORDER[requiredPlan]) {
      throw new ForbiddenException({
        error: 'upgrade_required',
        requiredPlan,
        currentPlan: userPlan,
        feature: requiredFeature || undefined,
        message: `This feature requires the ${requiredPlan} plan or higher.`,
      });
    }

    // Check feature flag requirement
    if (requiredFeature) {
      const featureValue = (limits as Record<string, any>)[requiredFeature];
      if (featureValue === false || featureValue === 0) {
        // Determine which plan unlocks this feature
        const unlockPlan = requiredFeature === 'multiLocation' ? 'enterprise' : 'professional';
        throw new ForbiddenException({
          error: 'upgrade_required',
          requiredPlan: unlockPlan,
          currentPlan: userPlan,
          feature: requiredFeature,
          message: `This feature requires the ${unlockPlan} plan.`,
        });
      }
    }

    return true;
  }
}
