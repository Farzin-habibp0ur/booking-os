/**
 * Central plan configuration — single source of truth for tier names,
 * pricing, Stripe env-var keys, and feature limits.
 */

export type PlanTier = 'starter' | 'professional' | 'enterprise';

export interface PlanLimits {
  maxStaff: number; // -1 = unlimited
  maxClients: number; // -1 = unlimited
  maxAgents: number; // 0 = none, -1 = unlimited
  whatsappInbox: boolean;
  smsNotifications: boolean;
  googleReviews: boolean;
  aiAutoReplies: boolean;
  campaigns: boolean;
  advancedReports: boolean;
  multiLocation: boolean;
  apiAccess: boolean;
  whiteLabelBooking: boolean;
}

export interface PlanConfig {
  tier: PlanTier;
  label: string;
  monthlyPrice: number;
  annualPrice: number;
  stripePriceEnvMonthly: string;
  stripePriceEnvAnnual: string;
  limits: PlanLimits;
}

export const PLAN_CONFIGS: Record<PlanTier, PlanConfig> = {
  starter: {
    tier: 'starter',
    label: 'Starter',
    monthlyPrice: 49,
    annualPrice: 39,
    stripePriceEnvMonthly: 'STRIPE_PRICE_ID_STARTER_MONTHLY',
    stripePriceEnvAnnual: 'STRIPE_PRICE_ID_STARTER_ANNUAL',
    limits: {
      maxStaff: 1,
      maxClients: 50,
      maxAgents: 0,
      whatsappInbox: false,
      smsNotifications: false,
      googleReviews: false,
      aiAutoReplies: false,
      campaigns: false,
      advancedReports: false,
      multiLocation: false,
      apiAccess: false,
      whiteLabelBooking: false,
    },
  },
  professional: {
    tier: 'professional',
    label: 'Professional',
    monthlyPrice: 99,
    annualPrice: 79,
    stripePriceEnvMonthly: 'STRIPE_PRICE_ID_PROFESSIONAL_MONTHLY',
    stripePriceEnvAnnual: 'STRIPE_PRICE_ID_PROFESSIONAL_ANNUAL',
    limits: {
      maxStaff: 5,
      maxClients: -1,
      maxAgents: 3,
      whatsappInbox: true,
      smsNotifications: true,
      googleReviews: true,
      aiAutoReplies: true,
      campaigns: true,
      advancedReports: true,
      multiLocation: false,
      apiAccess: false,
      whiteLabelBooking: false,
    },
  },
  enterprise: {
    tier: 'enterprise',
    label: 'Enterprise',
    monthlyPrice: 199,
    annualPrice: 159,
    stripePriceEnvMonthly: 'STRIPE_PRICE_ID_ENTERPRISE_MONTHLY',
    stripePriceEnvAnnual: 'STRIPE_PRICE_ID_ENTERPRISE_ANNUAL',
    limits: {
      maxStaff: -1,
      maxClients: -1,
      maxAgents: -1,
      whatsappInbox: true,
      smsNotifications: true,
      googleReviews: true,
      aiAutoReplies: true,
      campaigns: true,
      advancedReports: true,
      multiLocation: true,
      apiAccess: true,
      whiteLabelBooking: true,
    },
  },
};

export const PLAN_TIERS: PlanTier[] = ['starter', 'professional', 'enterprise'];

/** Map legacy plan names to new tiers */
export function normalizePlanTier(plan: string): PlanTier {
  if (plan === 'basic') return 'starter';
  if (plan === 'pro') return 'professional';
  if (PLAN_TIERS.includes(plan as PlanTier)) return plan as PlanTier;
  return 'starter';
}

/** Get effective plan for a business: checks subscription, falls back to trial/starter */
export function getEffectivePlan(subscription: { plan: string; status: string } | null): PlanTier {
  if (!subscription) return 'starter';
  return normalizePlanTier(subscription.plan);
}

/** During trial, all features are unlocked (returns enterprise limits) */
export function getEffectiveLimits(plan: PlanTier, isTrial: boolean): PlanLimits {
  if (isTrial) return PLAN_CONFIGS.enterprise.limits;
  return PLAN_CONFIGS[plan].limits;
}

/** Trial duration in days */
export const TRIAL_DAYS = 14;

/** Grace period after trial ends (days) */
export const GRACE_PERIOD_DAYS = 7;
