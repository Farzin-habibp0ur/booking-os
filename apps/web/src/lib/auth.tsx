'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from './api';
import { identifyUser, resetUser } from './posthog';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  locale: string | null;
  emailVerified: boolean;
  preferences: { mode?: string; landingPath?: string };
  businessId: string;
  business: {
    id: string;
    name: string;
    slug: string;
    verticalPack: string;
    defaultLocale: string;
    packConfig: Record<string, unknown> | null;
    createdAt: string;
    timezone?: string;
  };
  trial?: {
    isTrial: boolean;
    trialDaysRemaining: number;
    trialExpired: boolean;
    trialEndsAt: string | null;
    isGracePeriod: boolean;
  };
  viewAs?: boolean;
  viewAsSessionId?: string;
  originalRole?: string;
}

interface TwoFactorRequired {
  requires2FA: true;
  tempToken: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User | TwoFactorRequired>;
  complete2FA: (tempToken: string, code: string) => Promise<User>;
  signup: (
    businessName: string,
    ownerName: string,
    email: string,
    password: string,
    referralCode?: string,
  ) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  login: async () => ({}) as User,
  complete2FA: async () => ({}) as User,
  signup: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // C2 fix: Always try /auth/me — httpOnly cookies are sent automatically
  useEffect(() => {
    api
      .get<User>('/auth/me')
      .then((me) => {
        setUser(me);
        identifyUser(me.id, { email: me.email, businessId: me.businessId, role: me.role });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string): Promise<User | TwoFactorRequired> => {
    // Use Bearer token from login response for the immediate /auth/me call
    // to avoid stale cookie/cache issues when switching accounts
    const result = await api.post<{
      accessToken?: string;
      staff?: any;
      requires2FA?: boolean;
      tempToken?: string;
    }>('/auth/login', {
      email,
      password,
    });

    // P-17: If 2FA is required, return the temp token — don't set cookies
    if (result.requires2FA && result.tempToken) {
      return { requires2FA: true, tempToken: result.tempToken };
    }

    if (result.accessToken) {
      api.setToken(result.accessToken);
    }
    const me = await api.get<User>('/auth/me');
    setUser(me);
    identifyUser(me.id, { email: me.email, businessId: me.businessId, role: me.role });
    return me;
  };

  const complete2FA = async (tempToken: string, code: string): Promise<User> => {
    const result = await api.post<{ accessToken: string; staff: any }>('/auth/2fa/challenge', {
      tempToken,
      code,
    });
    if (result.accessToken) {
      api.setToken(result.accessToken);
    }
    const me = await api.get<User>('/auth/me');
    setUser(me);
    identifyUser(me.id, { email: me.email, businessId: me.businessId, role: me.role });
    return me;
  };

  const signup = async (
    businessName: string,
    ownerName: string,
    email: string,
    password: string,
    referralCode?: string,
  ) => {
    // C2 fix: Don't store token — httpOnly cookies handle auth
    await api.post<{ accessToken: string; staff: any }>('/auth/signup', {
      businessName,
      ownerName,
      email,
      password,
      ...(referralCode && { referralCode }),
    });
    const me = await api.get<User>('/auth/me');
    setUser(me);
    identifyUser(me.id, { email: me.email, businessId: me.businessId, role: me.role });
  };

  const logout = async () => {
    // C2 fix: Call API to clear httpOnly cookies server-side
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore — redirect to login regardless
    }
    api.setToken(null);
    setUser(null);
    resetUser();
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider
      value={{ user, token: api.getToken(), loading, login, complete2FA, signup, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
