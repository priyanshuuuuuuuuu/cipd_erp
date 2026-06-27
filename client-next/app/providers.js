'use client';

import { AuthProvider } from './contexts/AuthContext';
import { AppearanceProvider } from './contexts/AppearanceContext';

export function Providers({ children }) {
  return (
    <AuthProvider>
      <AppearanceProvider>{children}</AppearanceProvider>
    </AuthProvider>
  );
}
