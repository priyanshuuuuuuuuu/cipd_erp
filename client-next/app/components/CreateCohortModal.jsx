'use client';

import React, { useState, useMemo } from 'react';
import { X, Layers, Plus, CheckCircle, AlertCircle, Users, Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { useCohort } from '../contexts/CohortContext';
import { api } from '@/lib/api';

const COHORT_NAME_RE = /^[a-z][a-z0-9_]{2,40}$/;

export default function CreateCohortModal() {
  const { isCreateOpen, closeCreateModal, cohorts, activeCohort, switchCohort, refreshCohorts } = useCohort();

  const [label, setLabel] = useState('');
  const [schemaName, setSchemaName] = useState('');
  const [customSchema, setCustomSchema] = useState(false);
  const [sourceSchema, setSourceSchema] = useState(activeCohort || 'july');
  const [makeActive, setMakeActive] = useState(true);
  const [studentInput, setStudentInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  // Auto-generate clean schema name from label if user hasn't typed a custom one
  const handleLabelChange = (e) => {
    const val = e.target.value;
    setLabel(val);
    if (!customSchema) {
      const slug = val
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 30);
      setSchemaName(slug);
    }
  };

  // Parse student lines
  const parsedStudents = useMemo(() => {
    const lines = studentInput.split('\n');
    const valid = [];
    const invalid = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      // Format: Name, Email, EnrollmentNo (optional)
      const parts = line.split(/[,\t]+/).map(p => p.trim());
      if (parts.length >= 2) {
        const name = parts[0];
        const email = parts[1].toLowerCase();
        const enrollment = parts[2] || '';
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          valid.push({ name, email, enrollment_no: enrollment });
        } else {
          invalid.push({ line, error: 'Invalid email address' });
        }
      } else {
        invalid.push({ line, error: 'Expected: Name, Email' });
      }
    }
    return { valid, invalid };
  }, [studentInput]);

  const isValidSchema = COHORT_NAME_RE.test(schemaName);
  const isDuplicate = cohorts.some(c => c.schema === schemaName);

  if (!isCreateOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);

    if (!label.trim()) {
      setError('Please provide a cohort label (e.g. "August 2026")');
      return;
    }
    if (!isValidSchema) {
      setError('Schema name must be 3-41 characters: lowercase letters, digits, and underscores, starting with a letter.');
      return;
    }
    if (isDuplicate) {
      setError(`A cohort with schema name "${schemaName}" already exists.`);
      return;
    }

    try {
      setLoading(true);
      const res = await api.post('/api/admin/cohorts', {
        schemaName,
        label: label.trim(),
        sourceSchema: sourceSchema || activeCohort || 'july',
        makeActive,
        students: parsedStudents.valid,
      });

      setResult(res);
      await refreshCohorts();
    } catch (err) {
      setError(err.message || 'Failed to create cohort');
    } finally {
      setLoading(false);
    }
  };

  const handleFinishAndSwitch = () => {
    if (result?.schema) {
      closeCreateModal();
      switchCohort(result.schema);
    } else {
      closeCreateModal();
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px', overflowY: 'auto'
    }}>
      <div style={{
        background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '640px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden', border: '1px solid #e5e7eb',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #f0f0f0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #09090b 0%, #1e1e24 100%)', color: '#fff'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Layers size={18} color="#00E5FF" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Start a Fresh Cohort</h2>
              <p style={{ fontSize: '0.75rem', color: '#a1a1aa', margin: 0 }}>
                Clone structure & reference data into an isolated database schema
              </p>
            </div>
          </div>
          <button
            onClick={closeCreateModal}
            disabled={loading}
            style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {result ? (
            /* Success View */
            <div style={{ textAlign: 'center', padding: '16px 8px' }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '50%',
                background: '#ecfdf5', color: '#059669',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <CheckCircle size={32} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px', color: '#111827' }}>
                Cohort &ldquo;{result.label}&rdquo; Created!
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '0 0 24px' }}>
                Database schema <code>{result.schema}</code> is ready and initialized.
              </p>

              {/* Stats Grid */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px',
                marginBottom: '24px', textAlign: 'left'
              }}>
                <div style={{ padding: '12px', borderRadius: '10px', background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 600 }}>TABLES CLONED</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#111827' }}>{result.tables}</div>
                  <div style={{ fontSize: '0.68rem', color: '#9ca3af' }}>Structure & constraints</div>
                </div>
                <div style={{ padding: '12px', borderRadius: '10px', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: '0.7rem', color: '#166534', fontWeight: 600 }}>NEW STUDENTS</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#15803d' }}>{result.created}</div>
                  <div style={{ fontSize: '0.68rem', color: '#86efac' }}>Accounts created</div>
                </div>
                <div style={{ padding: '12px', borderRadius: '10px', background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: '0.7rem', color: '#1e40af', fontWeight: 600 }}>REUSED IDENTITIES</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#2563eb' }}>{result.reused}</div>
                  <div style={{ fontSize: '0.68rem', color: '#93c5fd' }}>Passwords preserved</div>
                </div>
              </div>

              {result.failed?.length > 0 && (
                <div style={{
                  padding: '12px 14px', borderRadius: '8px', background: '#fffbeb',
                  border: '1px solid #fef3c7', marginBottom: '20px', textAlign: 'left'
                }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b45309', marginBottom: '4px' }}>
                    ⚠️ {result.failed.length} row(s) were skipped:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.72rem', color: '#92400e' }}>
                    {result.failed.map((f, i) => (
                      <li key={i}>{f.email || 'Row'}: {f.error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                onClick={handleFinishAndSwitch}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  padding: '10px 24px', borderRadius: '10px', border: 'none',
                  background: '#000', color: '#fff', fontSize: '0.85rem', fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Switch to {result.label} Now <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            /* Form View */
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {error && (
                <div style={{
                  padding: '10px 14px', borderRadius: '8px', background: '#fef2f2',
                  border: '1px solid #fecaca', color: '#dc2626', fontSize: '0.8rem',
                  display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <div>{error}</div>
                </div>
              )}

              {/* Row 1: Label & Schema */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '6px' }}>
                    Cohort Display Label <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. August 2026"
                    value={label}
                    onChange={handleLabelChange}
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: '8px',
                      border: '1px solid #d1d5db', fontSize: '0.85rem', outline: 'none'
                    }}
                  />
                  <span style={{ fontSize: '0.68rem', color: '#9ca3af', marginTop: '4px', display: 'block' }}>
                    Shown to users across UI
                  </span>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151' }}>
                      Schema Name <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setCustomSchema(!customSchema)}
                      style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.68rem', cursor: 'pointer', padding: 0 }}
                    >
                      {customSchema ? 'Auto-generate' : 'Customize'}
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    disabled={!customSchema}
                    placeholder="e.g. august"
                    value={schemaName}
                    onChange={(e) => setSchemaName(e.target.value.toLowerCase().trim())}
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: '8px',
                      border: `1px solid ${!schemaName ? '#d1d5db' : isValidSchema && !isDuplicate ? '#10b981' : '#ef4444'}`,
                      background: customSchema ? '#fff' : '#f9fafb',
                      fontSize: '0.85rem', fontFamily: 'monospace', outline: 'none'
                    }}
                  />
                  <span style={{ fontSize: '0.68rem', color: isDuplicate ? '#ef4444' : isValidSchema ? '#059669' : '#9ca3af', marginTop: '4px', display: 'block' }}>
                    {isDuplicate
                      ? 'Already in use'
                      : isValidSchema
                      ? '✓ Valid PostgreSQL schema identifier'
                      : 'Lowercase, numbers, underscores (3-41 chars)'}
                  </span>
                </div>
              </div>

              {/* Row 2: Source Schema & Make Active */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px', alignItems: 'center' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '6px' }}>
                    Source Cohort to Clone From
                  </label>
                  <select
                    value={sourceSchema}
                    onChange={(e) => setSourceSchema(e.target.value)}
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: '8px',
                      border: '1px solid #d1d5db', fontSize: '0.85rem', background: '#fff'
                    }}
                  >
                    {cohorts.map((c) => (
                      <option key={c.schema} value={c.schema}>
                        {c.label} ({c.schema}) {c.schema === activeCohort ? '— Currently Active' : ''}
                      </option>
                    ))}
                  </select>
                  <span style={{ fontSize: '0.68rem', color: '#9ca3af', marginTop: '4px', display: 'block' }}>
                    Clones courses, faculty, categories & system settings
                  </span>
                </div>

                <div style={{ paddingTop: '10px' }}>
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    fontSize: '0.8rem', fontWeight: 600, color: '#1f2937', cursor: 'pointer'
                  }}>
                    <input
                      type="checkbox"
                      checked={makeActive}
                      onChange={(e) => setMakeActive(e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: '#00A5A0' }}
                    />
                    Set as active cohort immediately
                  </label>
                  <span style={{ fontSize: '0.68rem', color: '#6b7280', display: 'block', marginTop: '2px', marginLeft: '24px' }}>
                    Students & crons will automatically target this new cohort
                  </span>
                </div>
              </div>

              {/* Row 3: Enrol Students */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Users size={14} /> Enrol Students (Name, Email, [Enrollment No])
                  </label>
                  <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>
                    {parsedStudents.valid.length} student(s) detected
                  </span>
                </div>

                <textarea
                  rows={5}
                  value={studentInput}
                  onChange={(e) => setStudentInput(e.target.value)}
                  placeholder={`Rahul Sharma, rahul@iiitd.ac.in, IIITD001\nPriya Patel, priya@iiitd.ac.in, IIITD002\nAman Verma, aman@iiitd.ac.in`}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                    border: '1px solid #d1d5db', fontSize: '0.8rem', fontFamily: 'monospace',
                    lineHeight: 1.5, resize: 'vertical'
                  }}
                />

                <div style={{
                  marginTop: '6px', padding: '8px 12px', borderRadius: '8px',
                  background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '0.7rem', color: '#64748b'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 600, color: '#334155' }}>
                    <Sparkles size={12} color="#00A5A0" /> Seamless Cross-Cohort Student Identities:
                  </div>
                  <div>
                    If a student exists in an earlier cohort, their password and login are preserved automatically.
                    If they are a new student, an account is created with the student role.
                  </div>
                </div>

                {parsedStudents.invalid.length > 0 && (
                  <div style={{ fontSize: '0.7rem', color: '#dc2626', marginTop: '6px' }}>
                    ⚠️ {parsedStudents.invalid.length} line(s) could not be parsed as &ldquo;Name, valid-email&rdquo;.
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{
                display: 'flex', justifyContent: 'flex-end', gap: '10px',
                marginTop: '10px', paddingTop: '16px', borderTop: '1px solid #f0f0f0'
              }}>
                <button
                  type="button"
                  onClick={closeCreateModal}
                  disabled={loading}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db',
                    background: '#fff', color: '#374151', fontSize: '0.8rem', fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading || !isValidSchema || isDuplicate}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '7px',
                    padding: '8px 20px', borderRadius: '8px', border: 'none',
                    background: loading || !isValidSchema || isDuplicate ? '#9ca3af' : '#111827',
                    color: '#fff', fontSize: '0.8rem', fontWeight: 700,
                    cursor: loading || !isValidSchema || isDuplicate ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Cloning & Setting Up...
                    </>
                  ) : (
                    <>
                      <Plus size={14} />
                      Create & Initialize Cohort
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
