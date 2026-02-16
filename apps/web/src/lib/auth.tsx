'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from './api';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  locale: string | null;
  businessId: string;
  business: { id: string; name: string; slug: string; verticalPack: string; defaultLocale: string };
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

  useEffect(() => {
    const token = api.getToken();
    if (token) {
      api
        .get<User>('/auth/me')
        .then(setUser)
        .catch(() => {
          api.setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post<{ accessToken: string; staff: any }>('/auth/login', {
      email,
      password,
    });
    api.setToken(res.accessToken);
    const me = await api.get<User>('/auth/me');
    setUser(me);
  };

  const signup = async (
    businessName: string,
    ownerName: string,
    email: string,
    password: string,
  ) => {
    const res = await api.post<{ accessToken: string; staff: any }>('/auth/signup', {
      businessName,
      ownerName,
      email,
      password,
    });
    api.setToken(res.accessToken);
    const me = await api.get<User>('/auth/me');
    setUser(me);
  };

  const logout = () => {
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
