'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { api, getCohortRole } from '@/lib/api';
import { useAuth } from './AuthContext';

const CohortContext = createContext(null);

/**
 * Cohort state for the signed-in user. `cohorts` are objects from GET /api/cohorts:
 *   { id, schema, label, program, starts_on, ends_on, status: 'running'|'archived', is_default }
 * The server decides what the user may see (admins: all; faculty/students: their memberships) and enforces
 * read-only on non-running cohorts. `isReadOnly` here only disables controls for a better UX.
 */
export function CohortProvider({ children }) {
  const { user, authReady } = useAuth();
  const pathname = usePathname();
  const [cohorts, setCohorts] = useState([]);
  const [activeCohort, setActiveCohort] = useState(''); // schema of the default cohort
  const [selectedCohort, setSelectedCohort] = useState('');
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const fetchCohorts = useCallback(async () => {
    // The login page is shared by every role. Wait until the role-based
    // redirect has selected /admin, /faculty, or /dashboard before asking for
    // cohorts, so the API client reads the matching role-scoped token.
    if (!user || pathname === '/') {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await api.get('/api/cohorts');
      const list = data.cohorts || [];
      setCohorts(list);
      setActiveCohort(data.default || data.active || '');

      const role = getCohortRole();
      const stored = localStorage.getItem(`${role}_cohort`);

      // Stored preference if still valid, else the cohort the server resolved for us, else the default.
      const validStored = list.some((c) => c.schema === stored) ? stored : null;
      const initial = validStored || data.current || data.default || data.active || (list[0]?.schema ?? '');

      setSelectedCohort(initial);
      if (initial) localStorage.setItem(`${role}_cohort`, initial);
    } catch (err) {
      console.error('Failed to load cohorts:', err);
    } finally {
      setLoading(false);
    }
  }, [user, pathname]);

  useEffect(() => {
    if (authReady) fetchCohorts();
  }, [authReady, fetchCohorts]);

  const switchCohort = useCallback((schemaName) => {
    if (!schemaName || schemaName === selectedCohort) return;
    const role = getCohortRole();
    localStorage.setItem(`${role}_cohort`, schemaName);
    setSelectedCohort(schemaName);
    // Reload so every view refetches with the chosen x-cohort header
    if (typeof window !== 'undefined') window.location.reload();
  }, [selectedCohort]);

  /** Make a running cohort the default (new sign-ups, background jobs, landing cohort). */
  const makeActive = useCallback(async (schemaName) => {
    const target = cohorts.find((c) => c.schema === schemaName);
    if (!target) return;
    try {
      await api.patch(`/api/admin/cohorts/${target.id}`, { is_default: true });
      await fetchCohorts();
    } catch (err) {
      alert('Failed to set default cohort: ' + err.message);
      throw err;
    }
  }, [cohorts, fetchCohorts]);

  const selectedCohortObj = useMemo(
    () => cohorts.find((c) => c.schema === selectedCohort) || null,
    [cohorts, selectedCohort]
  );
  const runningCohorts = useMemo(() => cohorts.filter((c) => c.status === 'running'), [cohorts]);
  const isReadOnly = !!selectedCohortObj && selectedCohortObj.status !== 'running';

  return (
    <CohortContext.Provider
      value={{
        cohorts,
        runningCohorts,
        activeCohort,
        defaultCohort: activeCohort,
        selectedCohort,
        selectedCohortObj,
        isReadOnly,
        loading,
        isCreateOpen,
        openCreateModal: () => setIsCreateOpen(true),
        closeCreateModal: () => setIsCreateOpen(false),
        switchCohort,
        makeActive,
        refreshCohorts: fetchCohorts,
      }}
    >
      {children}
    </CohortContext.Provider>
  );
}

export function useCohort() {
  const ctx = useContext(CohortContext);
  if (!ctx) {
    throw new Error('useCohort must be used within a CohortProvider');
  }
  return ctx;
}
