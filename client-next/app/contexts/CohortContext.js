'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, getCohortRole } from '@/lib/api';
import { useAuth } from './AuthContext';

const CohortContext = createContext(null);

export function CohortProvider({ children }) {
  const { user, authReady } = useAuth();
  const [cohorts, setCohorts] = useState([]);
  const [activeCohort, setActiveCohort] = useState('');
  const [selectedCohort, setSelectedCohort] = useState('');
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const fetchCohorts = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await api.get('/api/cohorts');
      const list = data.cohorts || [];
      setCohorts(list);
      setActiveCohort(data.active || '');

      const role = getCohortRole();
      const stored = localStorage.getItem(`${role}_cohort`);
      
      // Determine what to select: stored preference if still valid, else data.current, else active
      const validStored = list.some(c => c.schema === stored) ? stored : null;
      const initial = validStored || data.current || data.active || (list[0]?.schema ?? '');

      setSelectedCohort(initial);
      if (initial) {
        localStorage.setItem(`${role}_cohort`, initial);
      }
    } catch (err) {
      console.error('Failed to load cohorts:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authReady) {
      fetchCohorts();
    }
  }, [authReady, fetchCohorts]);

  const switchCohort = useCallback((schemaName) => {
    if (!schemaName || schemaName === selectedCohort) return;
    const role = getCohortRole();
    localStorage.setItem(`${role}_cohort`, schemaName);
    setSelectedCohort(schemaName);
    // Reload the page to ensure all views immediately refetch with the chosen x-cohort header
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }, [selectedCohort]);

  const makeActive = useCallback(async (schemaName) => {
    try {
      await api.patch('/api/admin/cohorts', { schemaName });
      await fetchCohorts();
    } catch (err) {
      alert('Failed to set active cohort: ' + err.message);
      throw err;
    }
  }, [fetchCohorts]);

  return (
    <CohortContext.Provider
      value={{
        cohorts,
        activeCohort,
        selectedCohort,
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
