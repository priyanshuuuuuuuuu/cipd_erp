'use client';

import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import CohortSwitcher from './CohortSwitcher';
import CreateCohortModal from './CreateCohortModal';

export default function GlobalCohortBar() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <>
      <div
        className="global-cohort-bar"
        style={{
          position: 'fixed',
          top: '14px',
          right: '80px',
          zIndex: 850,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <CohortSwitcher />
      </div>
      <CreateCohortModal />
    </>
  );
}
