'use client';

import React, { createContext, useContext, useEffect, useCallback } from 'react';

const AppearanceContext = createContext(null);

function resolveTheme(theme) {
  if (theme === 'system' && typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme === 'dark' ? 'dark' : 'light';
}

let cachedTheme = 'light';
let cachedFontSize = 'medium';

function applyAppearance(theme, fontSize) {
  if (typeof document === 'undefined') return;
  cachedTheme = theme || 'light';
  cachedFontSize = fontSize || 'medium';
  const root = document.documentElement;
  root.setAttribute('data-theme', resolveTheme(cachedTheme));
  root.setAttribute('data-font-size', cachedFontSize);
}

export function AppearanceProvider({ children }) {
  const loadAppearance = useCallback(async () => {
    if (typeof window === 'undefined') return;

    const path = window.location.pathname;
    if (path.startsWith('/admin') || path.startsWith('/faculty') || path === '/') return;

    const token = localStorage.getItem('student_token');
    if (!token) {
      applyAppearance('light', 'medium');
      return;
    }

    try {
      const res = await fetch('/api/students/settings', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        const appearance = data.preferences?.appearance || {};
        applyAppearance(appearance.theme, appearance.fontSize);
      }
    } catch {
      applyAppearance('light', 'medium');
    }
  }, []);

  useEffect(() => {
    loadAppearance();

    const onUpdate = (e) => {
      const { theme, fontSize } = e.detail || {};
      applyAppearance(theme, fontSize);
    };

    window.addEventListener('appearance-updated', onUpdate);

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemChange = () => {
      if (cachedTheme === 'system') {
        applyAppearance('system', cachedFontSize);
      }
    };
    mq.addEventListener('change', onSystemChange);

    return () => {
      window.removeEventListener('appearance-updated', onUpdate);
      mq.removeEventListener('change', onSystemChange);
    };
  }, [loadAppearance]);

  return (
    <AppearanceContext.Provider value={{ applyAppearance }}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  return useContext(AppearanceContext);
}

export function dispatchAppearanceUpdate(theme, fontSize) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('appearance-updated', { detail: { theme, fontSize } }));
  }
}
