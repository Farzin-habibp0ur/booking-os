'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from './api';

const CUSTOMER_APP_URL =
  process.env.NEXT_PUBLIC_CUSTOMER_APP_URL || 'https://businesscommandcentre.com';

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

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<User>('/auth/me')
      .then((me) => {
        // Only SUPER_ADMIN users are allowed on the admin console
        if (me.role !== 'SUPER_ADMIN') {
          window.location.href = `${CUSTOMER_APP_URL}?error=unauthorized`;
          return;
        }
        setUser(me);
      })
      .catch(() => {
        // Auth failed — redirect to customer app login
        window.location.href = `${CUSTOMER_APP_URL}/login`;
      })
      .finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore — redirect regardless
    }
    api.setToken(null);
    setUser(null);
    window.location.href = `${CUSTOMER_APP_URL}/login`;
  };

  return (
    <AuthContext.Provider value={{ user, token: api.getToken(), loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
