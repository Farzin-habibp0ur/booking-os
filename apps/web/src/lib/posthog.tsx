'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useEffect } from 'react';

// Only initialize in browser with a valid key
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || '';
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

let initialized = false;

export function initPostHog() {
  if (POSTHOG_KEY && typeof window !== 'undefined' && !initialized) {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: true,
      capture_pageleave: true,
      persistence: 'localStorage+cookie',
    });
    initialized = true;
  }
}

export function isEnabled(): boolean {
  return initialized && !!POSTHOG_KEY;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initPostHog();
  }, []);

  if (!POSTHOG_KEY) return <>{children}</>;

  return <PHProvider client={posthog}>{children}</PHProvider>;
}

// Helper for custom event tracking (alias for backwards compat)
export function trackEvent(event: string, properties?: Record<string, any>) {
  if (isEnabled()) {
    posthog.capture(event, properties);
  }
}
export const captureEvent = trackEvent;

// Identify user after login
export function identifyUser(userId: string, properties?: Record<string, any>) {
  if (isEnabled()) {
    posthog.identify(userId, properties);
  }
}

// Reset user on logout
export function resetUser() {
  if (isEnabled()) {
    posthog.reset();
  }
}
