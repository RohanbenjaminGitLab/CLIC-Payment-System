import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, parseJson } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    const res = await api('/auth/me');
    if (!res.ok) {
      setUser(null);
      return null;
    }
    const data = await parseJson(res);
    setUser(data.user);
    return data.user;
  }, []);

  useEffect(() => {
    refreshMe().finally(() => setLoading(false));
  }, [refreshMe]);

  const login = async (email, password) => {
    const res = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    const data = await parseJson(res);
    if (!res.ok) throw new Error(data?.error || 'Login failed');
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' });
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      refreshMe,
      isAdmin: user?.role === 'admin',
      isManager: user?.role === 'manager',
      isStaff: user?.role === 'staff',
    }),
    [user, loading, refreshMe]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside provider');
  return ctx;
}
