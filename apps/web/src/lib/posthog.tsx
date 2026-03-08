'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useEffect } from 'react';

// Only initialize in browser with a valid key
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || '';
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (POSTHOG_KEY && typeof window !== 'undefined') {
      posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        capture_pageview: true,
        capture_pageleave: true,
        persistence: 'localStorage+cookie',
      });
    }
  }, []);

  if (!POSTHOG_KEY) return <>{children}</>;

  return <PHProvider client={posthog}>{children}</PHProvider>;
}

// Helper for custom event tracking
export function trackEvent(event: string, properties?: Record<string, any>) {
  if (POSTHOG_KEY && typeof window !== 'undefined') {
    posthog.capture(event, properties);
  }
}

// Identify user after login
export function identifyUser(userId: string, properties?: Record<string, any>) {
  if (POSTHOG_KEY && typeof window !== 'undefined') {
    posthog.identify(userId, properties);
  }
}
