import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('cp_user');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  const persistUser = (userData) => {
    setUser(userData);
    if (userData) {
      localStorage.setItem('cp_user', JSON.stringify(userData));
    } else {
      localStorage.removeItem('cp_user');
      localStorage.removeItem('cp_token');
    }
  };

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('cp_token');
    if (!token) { setLoading(false); return; }
    try {
      const res = await authAPI.getMe();
      persistUser(res.data.user);
    } catch {
      persistUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshUser(); }, [refreshUser]);

  const login = async (email, password) => {
    const res = await authAPI.login({ email, password });
    localStorage.setItem('cp_token', res.data.token);
    persistUser(res.data.user);
    return res.data;
  };

  const register = async (data) => {
    const res = await authAPI.register(data);
    localStorage.setItem('cp_token', res.data.token);
    persistUser(res.data.user);
    return res.data;
  };

  const logout = () => {
    persistUser(null);
    window.location.href = '/';
  };

  const updateUser = (updates) => {
    const updated = { ...user, ...updates };
    persistUser(updated);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
