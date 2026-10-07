'use client';

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import CohortSwitcher from './CohortSwitcher';
import CreateCohortModal from './CreateCohortModal';

export default function GlobalCohortBar() {
  const { user } = useAuth();
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
      <CreateCohortModal />
    </>
  );
}
