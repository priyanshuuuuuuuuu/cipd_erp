'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Layers, ChevronDown, Check, Plus, Star, Radio } from 'lucide-react';
import { useCohort } from '../contexts/CohortContext';
import { useAuth } from '../contexts/AuthContext';

export default function CohortSwitcher({ sidebarMode = false }) {
  const { user } = useAuth();
  const { cohorts, activeCohort, selectedCohort, switchCohort, makeActive, openCreateModal } = useCohort();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user || !cohorts.length) return null;

  const currentObj = cohorts.find(c => c.schema === selectedCohort) || cohorts[0] || { label: 'Cohort', schema: selectedCohort };
  const isCurrentActive = currentObj.schema === activeCohort;
  const isAdmin = user.role === 'admin';

  if (sidebarMode) {
    return (
      <div ref={ref} style={{ position: 'relative', width: '100%' }}>
        {/* Sidebar Cohort Button */}
        <button
          onClick={() => setOpen(!open)}
          title="Switch Cohort"
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            width: '100%', padding: '8px 12px', borderRadius: '8px',
            border: '1px solid #2a2a2a',
            background: '#1a1a1a',
            color: '#e2e8f0',
            fontSize: '0.75rem', fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.15s ease',
            boxSizing: 'border-box',
          }}
        >
          <div style={{
            width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
            background: isCurrentActive ? '#10b981' : '#f59e0b',
            boxShadow: isCurrentActive ? '0 0 5px rgba(16,185,129,0.7)' : 'none'
          }} />
          <Layers size={13} color="#888" style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
            {currentObj.label}
          </span>
          <span style={{
            fontSize: '0.58rem', padding: '1px 5px', borderRadius: '4px', flexShrink: 0,
            background: isCurrentActive ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
            color: isCurrentActive ? '#34d399' : '#fbbf24',
            fontWeight: 700
          }}>
            {isCurrentActive ? 'Active' : 'Past'}
          </span>
          <ChevronDown size={12} color="#555" style={{ flexShrink: 0 }} />
        </button>

        {/* Sidebar Dropdown */}
        {open && (
          <div style={{
            position: 'absolute', left: 0, right: 0, top: 'calc(100% + 4px)',
            background: '#1e1e1e', borderRadius: '10px',
            border: '1px solid #2a2a2a',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            padding: '4px', zIndex: 9000, overflow: 'hidden'
          }}>
            <div style={{
              padding: '5px 8px 6px', borderBottom: '1px solid #2a2a2a',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <span style={{ fontSize: '0.63rem', fontWeight: 700, textTransform: 'uppercase', color: '#555', letterSpacing: '0.5px' }}>
                Select Cohort
              </span>
              <span style={{ fontSize: '0.62rem', color: '#444' }}>{cohorts.length} available</span>
            </div>

            <div style={{ maxHeight: '180px', overflowY: 'auto', padding: '3px 0' }}>
              {cohorts.map((c) => {
                const isSelected = c.schema === selectedCohort;
                const isActive = c.schema === activeCohort;
                return (
                  <div
                    key={c.schema}
                    onClick={() => { switchCohort(c.schema); setOpen(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '7px 8px', borderRadius: '6px', cursor: 'pointer',
                      background: isSelected ? '#2a2a2a' : 'transparent',
                      transition: 'background 0.1s ease', marginBottom: '2px'
                    }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#252525'; }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', overflow: 'hidden' }}>
                      <div style={{ width: '5px', height: '5px', borderRadius: '50%', flexShrink: 0, background: isActive ? '#10b981' : '#3a3a3a' }} />
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: isSelected ? 700 : 500, color: isSelected ? '#f1f5f9' : '#94a3b8', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {c.label}
                        </div>
                        <div style={{ fontSize: '0.6rem', color: '#444', fontFamily: 'monospace' }}>schema: {c.schema}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                      {isActive && (
                        <span style={{ fontSize: '0.58rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(16,185,129,0.15)', color: '#34d399', fontWeight: 700 }}>Active</span>
                      )}
                      {isAdmin && !isActive && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); if (confirm(`Set "${c.label}" as the active cohort?`)) makeActive(c.schema); }}
                          title="Set as Active Cohort"
                          style={{ padding: '2px 6px', fontSize: '0.6rem', fontWeight: 600, borderRadius: '4px', border: '1px solid #333', background: '#222', color: '#888', cursor: 'pointer' }}
                        >
                          Set Active
                        </button>
                      )}
                      {isSelected && <Check size={13} color="#00A5A0" />}
                    </div>
                  </div>
                );
              })}
            </div>

            {isAdmin && (
              <div style={{ borderTop: '1px solid #2a2a2a', paddingTop: '4px', marginTop: '2px' }}>
                <button
                  onClick={() => { setOpen(false); openCreateModal(); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    padding: '7px 10px', borderRadius: '6px', border: 'none',
                    background: '#00A5A0', color: '#fff', fontSize: '0.72rem', fontWeight: 600,
                    cursor: 'pointer', transition: 'opacity 0.15s'
                  }}
                >
                  <Plus size={13} /> Start Fresh Cohort
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Switcher Pill Button */}
      <button
        onClick={() => setOpen(!open)}
        title="Switch Cohort"
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '6px 12px', borderRadius: '10px',
          border: '1px solid #e2e8f0',
          background: isCurrentActive ? '#f8fafc' : '#fffbeb',
          color: '#0f172a',
          fontSize: '0.78rem', fontWeight: 600,
          cursor: 'pointer', transition: 'all 0.15s ease',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
        }}
      >
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: isCurrentActive ? '#10b981' : '#f59e0b',
          boxShadow: isCurrentActive ? '0 0 6px rgba(16, 185, 129, 0.6)' : 'none'
        }} />
        <Layers size={14} color="#64748b" />
        <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentObj.label}
        </span>
        <span style={{
          fontSize: '0.62rem', padding: '1px 6px', borderRadius: '4px',
          background: isCurrentActive ? '#dcfce7' : '#fef3c7',
          color: isCurrentActive ? '#15803d' : '#b45309',
          fontWeight: 700
        }}>
          {isCurrentActive ? 'Active' : 'Viewing Past'}
        </span>
        <ChevronDown size={13} color="#94a3b8" />
      </button>

      {/* Dropdown Menu */}
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 6px)',
          width: '260px', background: '#fff', borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
          padding: '6px', zIndex: 9000, overflow: 'hidden'
        }}>
          <div style={{
            padding: '6px 10px 8px', borderBottom: '1px solid #f1f5f9',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>
              Select Cohort
            </span>
            <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
              {cohorts.length} available
            </span>
          </div>

          <div style={{ maxHeight: '200px', overflowY: 'auto', padding: '4px 0' }}>
            {cohorts.map((c) => {
              const isSelected = c.schema === selectedCohort;
              const isActive = c.schema === activeCohort;

              return (
                <div
                  key={c.schema}
                  onClick={() => {
                    switchCohort(c.schema);
                    setOpen(false);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 10px', borderRadius: '8px', cursor: 'pointer',
                    background: isSelected ? '#f1f5f9' : 'transparent',
                    transition: 'background 0.1s ease', marginBottom: '2px'
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#f8fafc'; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <div style={{
                      width: '6px', height: '6px', borderRadius: '50%',
                      background: isActive ? '#10b981' : '#cbd5e1'
                    }} />
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: isSelected ? 700 : 500, color: '#1e293b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {c.label}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                        schema: {c.schema}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isActive && (
                      <span style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: '4px', background: '#dcfce7', color: '#166534', fontWeight: 700 }}>
                        Active
                      </span>
                    )}

                    {isAdmin && !isActive && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Set "${c.label}" as the active cohort for all new students and crons?`)) {
                            makeActive(c.schema);
                          }
                        }}
                        title="Set as Active Cohort"
                        style={{
                          padding: '2px 6px', fontSize: '0.62rem', fontWeight: 600,
                          borderRadius: '4px', border: '1px solid #e2e8f0',
                          background: '#fff', color: '#475569', cursor: 'pointer'
                        }}
                      >
                        Set Active
                      </button>
                    )}

                    {isSelected && <Check size={14} color="#00A5A0" />}
                  </div>
                </div>
              );
            })}
          </div>

          {isAdmin && (
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '4px', marginTop: '4px' }}>
              <button
                onClick={() => {
                  setOpen(false);
                  openCreateModal();
                }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  padding: '8px 10px', borderRadius: '8px', border: 'none',
                  background: '#09090b', color: '#fff', fontSize: '0.75rem', fontWeight: 600,
                  cursor: 'pointer', transition: 'opacity 0.15s'
                }}
              >
                <Plus size={14} /> Start Fresh Cohort
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
