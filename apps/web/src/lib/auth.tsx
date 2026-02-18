'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from './api';

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
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    businessName: string,
    ownerName: string,
    email: string,
    password: string,
  ) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  login: async () => {},
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
      .then(setUser)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    // Use Bearer token from login response for the immediate /auth/me call
    // to avoid stale cookie/cache issues when switching accounts
    const { accessToken } = await api.post<{ accessToken: string; staff: any }>('/auth/login', {
      email,
      password,
    });
    api.setToken(accessToken);
    const me = await api.get<User>('/auth/me');
    setUser(me);
  };

  const signup = async (
    businessName: string,
    ownerName: string,
    email: string,
    password: string,
  ) => {
    // C2 fix: Don't store token — httpOnly cookies handle auth
    await api.post<{ accessToken: string; staff: any }>('/auth/signup', {
      businessName,
      ownerName,
      email,
      password,
    });
    const me = await api.get<User>('/auth/me');
    setUser(me);
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
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, token: api.getToken(), loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
