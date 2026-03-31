'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Pick the expected role from the current URL so admin tabs restore admin sessions
    // and student tabs restore student sessions, even if both tokens exist in storage.
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    let expectedRole = 'student';
    if (path.startsWith('/admin')) expectedRole = 'admin';
    else if (path.startsWith('/faculty')) expectedRole = 'faculty';

    // Try the URL-expected role first, then fall through to others, then legacy key
    const roleOrder = [
      expectedRole,
      ...['student', 'admin', 'faculty'].filter(r => r !== expectedRole),
    ];

    let restored = false;
    for (const role of roleOrder) {
      const savedToken = localStorage.getItem(`${role}_token`);
      const savedUser  = localStorage.getItem(`${role}_user`);
      if (savedToken && savedUser) {
        try {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
          restored = true;
        } catch {
          localStorage.removeItem(`${role}_token`);
          localStorage.removeItem(`${role}_user`);
        }
        break;
      }
    }

    // Legacy fallback — plain 'token' / 'user' keys
    if (!restored) {
      const savedToken = localStorage.getItem('token');
      const savedUser  = localStorage.getItem('user');
      if (savedToken && savedUser) {
        try {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
        } catch {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }
    }

    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }

    localStorage.setItem(`${data.user.role}_token`, data.token);
    localStorage.setItem(`${data.user.role}_user`,  JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);

    return data.user;
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      // Ignore logout API errors
    }
    // Clear all possible role-scoped keys
    ['student', 'admin', 'faculty'].forEach(role => {
      localStorage.removeItem(`${role}_token`);
      localStorage.removeItem(`${role}_user`);
    });
    // Also clear legacy keys
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, authReady: !loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
