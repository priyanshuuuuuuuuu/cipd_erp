'use client';

import { AuthProvider } from './contexts/AuthContext';
import { CohortProvider } from './contexts/CohortContext';
import { AppearanceProvider } from './contexts/AppearanceContext';
import GlobalCohortBar from './components/GlobalCohortBar';
import StudentMobileNav from './components/StudentMobileNav';

export function Providers({ children }) {
  return (
    <AuthProvider>
      <CohortProvider>
        <AppearanceProvider>
          {children}
          <GlobalCohortBar />
          <StudentMobileNav />
        </AppearanceProvider>
      </CohortProvider>
    </AuthProvider>
  );
}
