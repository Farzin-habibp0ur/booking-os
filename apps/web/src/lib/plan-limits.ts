export type PlanTier = 'free' | 'starter' | 'professional' | 'enterprise';

export interface PlanLimits {
  bookings: number;
  staff: number;
  automations: number;
  sequences: number;
  services: number;
}

const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    bookings: 50,
    staff: 1,
    automations: 2,
    sequences: 1,
    services: 3,
  },
  starter: {
    bookings: 500,
    staff: 3,
    automations: 5,
    sequences: 3,
    services: 10,
  },
  professional: {
    bookings: 5000,
    staff: 10,
    automations: 25,
    sequences: 10,
    services: 50,
  },
  enterprise: {
    bookings: Infinity,
    staff: Infinity,
    automations: Infinity,
    sequences: Infinity,
    services: Infinity,
  },
};

const UPGRADE_PATH: Record<PlanTier, PlanTier | null> = {
  free: 'starter',
  starter: 'professional',
  professional: 'enterprise',
  enterprise: null,
};

const PLAN_LABELS: Record<PlanTier, string> = {
  free: 'Free',
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
};

export function getPlanLimits(plan: string): PlanLimits {
  const tier = plan.toLowerCase() as PlanTier;
  return PLAN_LIMITS[tier] || PLAN_LIMITS.free;
}

export function getUpgradePlan(plan: string): { tier: PlanTier; label: string } | null {
  const tier = plan.toLowerCase() as PlanTier;
  const next = UPGRADE_PATH[tier];
  if (!next) return null;
  return { tier: next, label: PLAN_LABELS[next] };
}

export function isNearLimit(
  current: number,
  plan: string,
  resource: keyof PlanLimits,
): boolean {
  const limits = getPlanLimits(plan);
  const limit = limits[resource];
  if (limit === Infinity) return false;
  return current >= limit * 0.8;
}

export function isAtLimit(
  current: number,
  plan: string,
  resource: keyof PlanLimits,
): boolean {
  const limits = getPlanLimits(plan);
  const limit = limits[resource];
  if (limit === Infinity) return false;
  return current >= limit;
}

export function getUsagePercent(
  current: number,
  plan: string,
  resource: keyof PlanLimits,
): number {
  const limits = getPlanLimits(plan);
  const limit = limits[resource];
  if (limit === Infinity) return 0;
  return Math.min(100, Math.round((current / limit) * 100));
}

export function getLimitValue(plan: string, resource: keyof PlanLimits): number {
  return getPlanLimits(plan)[resource];
}
