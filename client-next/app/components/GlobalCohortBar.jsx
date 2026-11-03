'use client';

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCohort } from '../contexts/CohortContext';
import CohortSwitcher from './CohortSwitcher';
import CreateCohortModal from './CreateCohortModal';

export default function GlobalCohortBar() {
  const { user } = useAuth();
  const { isReadOnly, selectedCohortObj } = useCohort();
  const [portalTarget, setPortalTarget] = useState(null);

  useEffect(() => {
    // Attempt to find the sidebar portal target on mount and whenever DOM changes
    const findPortal = () => {
      const el = document.getElementById('cohort-switcher-portal');
      if (el) setPortalTarget(el);
    };

    findPortal();

    // Use a MutationObserver to detect when the portal target is added to the DOM
    // (handles navigation between admin pages)
    const observer = new MutationObserver(findPortal);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  if (!user) return null;

  return (
    <>
      {portalTarget
        ? ReactDOM.createPortal(<CohortSwitcher sidebarMode />, portalTarget)
        : null}
      {isReadOnly && (
        <div
          role="status"
          style={{
            position: 'fixed', bottom: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 8000,
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 999,
            background: '#fffbeb', color: '#92400e', border: '1px solid #fcd34d',
            fontSize: '0.78rem', fontWeight: 600, boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
          }}
        >
          <Lock size={14} /> {selectedCohortObj?.label}: archived, read-only
        </div>
      )}
      <CreateCohortModal />
    </>
  );
}
