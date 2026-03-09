'use client';

import { createContext, useContext, useEffect, ReactNode } from 'react';
import { initPostHog, identifyUser, resetUser, isEnabled } from '@/lib/posthog';
import { useAuth } from '@/lib/auth';

interface PostHogContextType {
  isEnabled: boolean;
}

const PostHogContext = createContext<PostHogContextType>({ isEnabled: false });

export function PostHogIdentityProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  useEffect(() => {
    initPostHog();
  }, []);

  // Identify user when session is available
  useEffect(() => {
    if (user && isEnabled()) {
      identifyUser(user.id, {
        email: user.email,
        name: user.name,
        businessId: user.businessId,
        businessName: user.business?.name,
        role: user.role,
        verticalPack: user.business?.verticalPack,
      });
    }
  }, [user]);

  // Reset on logout (user becomes null)
  useEffect(() => {
    return () => {
      if (!user) resetUser();
    };
  }, [user]);

  return (
    <PostHogContext.Provider value={{ isEnabled: isEnabled() }}>
      {children}
    </PostHogContext.Provider>
  );
}

export const usePostHog = () => useContext(PostHogContext);
