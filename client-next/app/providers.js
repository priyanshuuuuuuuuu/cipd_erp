'use client';

import { AuthProvider } from './contexts/AuthContext';
import { CohortProvider } from './contexts/CohortContext';
import { AppearanceProvider } from './contexts/AppearanceContext';
import GlobalCohortBar from './components/GlobalCohortBar';

export function Providers({ children }) {
  return (
    <AuthProvider>
      <CohortProvider>
        <AppearanceProvider>
          {children}
          <GlobalCohortBar />
        </AppearanceProvider>
      </CohortProvider>
    </AuthProvider>
  );
}
