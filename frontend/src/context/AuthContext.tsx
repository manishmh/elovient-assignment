import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, tokens } from '../services/api';
import type { AuthUser } from '../types';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthBody {
  data: { user: AuthUser; accessToken: string; refreshToken: string };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokens.get()) {
      setLoading(false);
      return;
    }
    api<{ data: AuthUser }>('/api/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => {
        tokens.clear();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await api<AuthBody>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    tokens.set(res.data.accessToken, res.data.refreshToken);
    setUser(res.data.user);
  }

  async function register(email: string, password: string) {
    const res = await api<AuthBody>('/api/auth/register', {
      method: 'POST',
      body: { email, password },
    });
    tokens.set(res.data.accessToken, res.data.refreshToken);
    setUser(res.data.user);
  }

  async function logout() {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch {
      /* token may already be invalid — clear locally regardless */
    }
    tokens.clear();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
