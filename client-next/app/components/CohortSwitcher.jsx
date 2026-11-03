'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Layers, ChevronDown, Check, Plus, Settings } from 'lucide-react';
import { useCohort } from '../contexts/CohortContext';
import { useAuth } from '../contexts/AuthContext';

const THEMES = {
  sidebar: {
    button: { border: '1px solid #2a2a2a', background: '#1a1a1a', color: '#e2e8f0', width: '100%', padding: '8px 12px', borderRadius: '8px', fontSize: '0.75rem' },
    menu: { left: 0, right: 0, background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' },
    heading: '#555', muted: '#444', text: '#94a3b8', textSelected: '#f1f5f9', hover: '#252525', selected: '#2a2a2a', rule: '#2a2a2a',
    create: { background: '#00A5A0', color: '#fff' },
  },
  light: {
    button: { border: '1px solid #e2e8f0', background: '#f8fafc', color: '#0f172a', padding: '6px 12px', borderRadius: '10px', fontSize: '0.78rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
    menu: { right: 0, width: '280px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' },
    heading: '#64748b', muted: '#94a3b8', text: '#1e293b', textSelected: '#0f172a', hover: '#f8fafc', selected: '#f1f5f9', rule: '#f1f5f9',
    create: { background: '#09090b', color: '#fff' },
  },
};

function fmtDates(c) {
  const f = (d) => (d ? String(d).slice(0, 10) : '');
  if (!c.starts_on && !c.ends_on) return '';
  return `${f(c.starts_on)} – ${f(c.ends_on) || 'ongoing'}`;
}

function Badge({ children, tone }) {
  const tones = {
    default: { background: 'rgba(16,185,129,0.15)', color: '#10b981' },
    archived: { background: 'rgba(245,158,11,0.15)', color: '#d97706' },
  };
  return (
    <span style={{ fontSize: '0.58rem', padding: '1px 5px', borderRadius: '4px', fontWeight: 700, flexShrink: 0, ...tones[tone] }}>
      {children}
    </span>
  );
}

export default function CohortSwitcher({ sidebarMode = false }) {
  const { user } = useAuth();
  const { cohorts, activeCohort, selectedCohort, selectedCohortObj, switchCohort, makeActive, openCreateModal } = useCohort();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const t = sidebarMode ? THEMES.sidebar : THEMES.light;

  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  if (!user || !cohorts.length) return null;

  const current = selectedCohortObj || cohorts[0];
  const archived = current.status !== 'running';
  const isAdmin = user.role === 'admin';
  const running = cohorts.filter((c) => c.status === 'running');
  const past = cohorts.filter((c) => c.status !== 'running');

  const row = (c) => {
    const isSelected = c.schema === selectedCohort;
    const isDefault = c.schema === activeCohort;
    return (
      <div
        key={c.schema}
        onClick={() => { switchCohort(c.schema); setOpen(false); }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 8px', borderRadius: '6px',
          cursor: 'pointer', background: isSelected ? t.selected : 'transparent', marginBottom: '2px',
        }}
        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = t.hover; }}
        onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
      >
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: isSelected ? 700 : 500, color: isSelected ? t.textSelected : t.text, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
            {c.label}
          </div>
          <div style={{ fontSize: '0.6rem', color: t.muted }}>{fmtDates(c) || c.schema}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
          {isDefault && <Badge tone="default">Default</Badge>}
          {isAdmin && !isDefault && c.status === 'running' && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); if (confirm(`Make "${c.label}" the default cohort (new sign-ups and background jobs)?`)) makeActive(c.schema); }}
              title="Make default"
              style={{ padding: '2px 6px', fontSize: '0.6rem', fontWeight: 600, borderRadius: '4px', border: `1px solid ${t.rule}`, background: 'transparent', color: t.heading, cursor: 'pointer' }}
            >
              Make default
            </button>
          )}
          {isSelected && <Check size={13} color="#00A5A0" />}
        </div>
      </div>
    );
  };

  const group = (title, list) => list.length > 0 && (
    <div key={title}>
      <div style={{ padding: '6px 8px 3px', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: t.heading }}>{title}</div>
      {list.map(row)}
    </div>
  );

  return (
    <div ref={ref} style={{ position: 'relative', width: sidebarMode ? '100%' : undefined, display: sidebarMode ? undefined : 'inline-block' }}>
      <button
        onClick={() => setOpen(!open)}
        title="Switch cohort"
        style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', boxSizing: 'border-box', fontWeight: 600, ...t.button }}
      >
        <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: archived ? '#f59e0b' : '#10b981' }} />
        <Layers size={13} color="#888" style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left', maxWidth: sidebarMode ? undefined : 140 }}>{current.label}</span>
        <Badge tone={archived ? 'archived' : 'default'}>{archived ? 'Archived' : 'Running'}</Badge>
        <ChevronDown size={12} color="#777" style={{ flexShrink: 0 }} />
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', padding: '4px', zIndex: 9000, overflow: 'hidden', ...t.menu }}>
          <div style={{ maxHeight: 260, overflowY: 'auto', padding: '3px 0' }}>
            {group('Running', running)}
            {group('Archived', past)}
          </div>
          {isAdmin && (
            <div style={{ borderTop: `1px solid ${t.rule}`, paddingTop: 4, marginTop: 2, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Link
                href="/admin/cohorts"
                onClick={() => setOpen(false)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 10px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600, color: t.text, textDecoration: 'none', border: `1px solid ${t.rule}` }}
              >
                <Settings size={13} /> Manage cohorts
              </Link>
              <button
                onClick={() => { setOpen(false); openCreateModal(); }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 10px', borderRadius: 6, border: 'none', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', ...t.create }}
              >
                <Plus size={13} /> New cohort
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
