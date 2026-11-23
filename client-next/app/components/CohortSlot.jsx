'use client';

import { useAuth } from '../contexts/AuthContext';
import { useCohort } from '../contexts/CohortContext';

/**
 * Sidebar mount point for the cohort switcher on student and faculty pages (GlobalCohortBar portals into it).
 * Faculty and students see it only when they belong to more than one cohort; the server still decides which
 * cohorts they may open (their memberships) and keeps archived / non-active memberships read-only.
 */
export default function CohortSlot({ collapsed = false }) {
  const { user } = useAuth();
  const { cohorts } = useCohort();
  if (!user || cohorts.length < 2) return null;
  return (
    <div
      id="cohort-switcher-portal"
      style={{ padding: '0 1rem 1rem', display: collapsed ? 'none' : 'block', width: '100%', boxSizing: 'border-box' }}
    />
  );
}
