'use client';

import React, { useState, useMemo } from 'react';
import { X, Layers, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useCohort } from '../contexts/CohortContext';
import { api } from '@/lib/api';

const COHORT_NAME_RE = /^[a-z][a-z0-9_]{2,40}$/;

const field = { width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.85rem', boxSizing: 'border-box', background: '#fff' };
const labelStyle = { display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.3px' };

/**
 * Creates a cohort through POST /api/admin/cohorts. The structure comes from the versioned migrations on the
 * server (no copy of another cohort's tables); "reference cohort" only supplies courses/venues/skills/settings
 * and the faculty list.
 */
export default function CreateCohortModal() {
  const { isCreateOpen, closeCreateModal, cohorts, runningCohorts, activeCohort, switchCohort, refreshCohorts } = useCohort();

  const defaultObj = cohorts.find((c) => c.schema === activeCohort);
  const [label, setLabel] = useState('');
  const [schemaName, setSchemaName] = useState('');
  const [customSchema, setCustomSchema] = useState(false);
  const [program, setProgram] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [copyFromId, setCopyFromId] = useState('');
  const [makeDefault, setMakeDefault] = useState(false);
  const [studentInput, setStudentInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const handleLabelChange = (e) => {
    const val = e.target.value;
    setLabel(val);
    if (!customSchema) {
      setSchemaName(val.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30));
    }
  };

  const parsedStudents = useMemo(() => {
    const valid = [];
    const invalid = [];
    for (const raw of studentInput.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      const parts = line.split(/[,\t]+/).map((p) => p.trim()); // Name, Email, EnrollmentNo (optional)
      if (parts.length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parts[1])) {
        valid.push({ name: parts[0], email: parts[1].toLowerCase(), enrollment_no: parts[2] || '' });
      } else {
        invalid.push(line);
      }
    }
    return { valid, invalid };
  }, [studentInput]);

  if (!isCreateOpen) return null;

  const isValidSchema = COHORT_NAME_RE.test(schemaName);
  const isDuplicate = cohorts.some((c) => c.schema === schemaName);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!label.trim()) return setError('Please provide a cohort label (for example "January 2027").');
    if (!isValidSchema) return setError('Schema name must be 3-41 characters: lowercase letters, digits and underscores, starting with a letter.');
    if (isDuplicate) return setError(`A cohort with schema name "${schemaName}" already exists.`);
    if (endsOn && startsOn && endsOn < startsOn) return setError('The end date is before the start date.');

    try {
      setLoading(true);
      const res = await api.post('/api/admin/cohorts', {
        schema_name: schemaName,
        label: label.trim(),
        program: program.trim() || undefined,
        starts_on: startsOn || undefined,
        ends_on: endsOn || undefined,
        reference_from_cohort_id: referenceId ? Number(referenceId) : (defaultObj?.id ?? undefined),
        copy_active_students_from_cohort_id: copyFromId ? Number(copyFromId) : undefined,
        students: parsedStudents.valid,
        make_default: makeDefault,
      });
      setResult(res);
      await refreshCohorts();
    } catch (err) {
      setError(err.message || 'Failed to create cohort');
      await refreshCohorts(); // a failed cohort now appears under Admin > Cohorts with a Retry button
    } finally {
      setLoading(false);
    }
  };

  const finish = () => {
    const schema = result?.schema;
    closeCreateModal();
    if (schema) switchCohort(schema);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
        <div style={{ padding: '18px 24px', background: 'linear-gradient(135deg,#09090b,#1e1e24)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Layers size={20} />
            <div>
              <div style={{ fontWeight: 700 }}>New cohort</div>
              <div style={{ fontSize: '0.72rem', color: '#a1a1aa' }}>Creates a new, empty cohort with the standard structure</div>
            </div>
          </div>
          <button onClick={closeCreateModal} disabled={loading} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {result ? (
          <div style={{ padding: 24, overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#15803d', fontWeight: 700, marginBottom: 12 }}>
              <CheckCircle size={20} /> Cohort “{result.label}” is running
            </div>
            <div style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.7 }}>
              <div>New student accounts: <b>{result.created}</b> (each gets a set-password email)</div>
              <div>Existing accounts re-used: <b>{result.reused}</b></div>
              {result.failed?.length > 0 && (
                <div style={{ marginTop: 8, color: '#b91c1c' }}>
                  <b>{result.failed.length} could not be added:</b>
                  <ul style={{ margin: '4px 0 0 18px' }}>
                    {result.failed.slice(0, 20).map((f, i) => <li key={i}>{f.email || '(blank)'} – {f.error}</li>)}
                  </ul>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button onClick={closeCreateModal} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>Close</button>
              <button onClick={finish} style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: '#09090b', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Open this cohort</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} style={{ padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Label</label>
              <input style={field} value={label} onChange={handleLabelChange} placeholder='e.g. "January 2027"' autoFocus />
            </div>
            <div>
              <label style={labelStyle}>Schema name</label>
              <input
                style={{ ...field, fontFamily: 'monospace', borderColor: schemaName && (!isValidSchema || isDuplicate) ? '#ef4444' : '#d1d5db' }}
                value={schemaName}
                onChange={(e) => { setCustomSchema(true); setSchemaName(e.target.value.toLowerCase()); }}
              />
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 3 }}>Permanent. Lowercase letters, digits, underscores.</div>
            </div>
            <div>
              <label style={labelStyle}>Program (optional)</label>
              <input style={field} value={program} onChange={(e) => setProgram(e.target.value)} placeholder="e.g. iPD-CP" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={labelStyle}>Starts on</label><input type="date" style={field} value={startsOn} onChange={(e) => setStartsOn(e.target.value)} /></div>
              <div><label style={labelStyle}>Ends on</label><input type="date" style={field} value={endsOn} onChange={(e) => setEndsOn(e.target.value)} /></div>
            </div>
            <div>
              <label style={labelStyle}>Copy reference data from</label>
              <select style={field} value={referenceId} onChange={(e) => setReferenceId(e.target.value)}>
                <option value="">{defaultObj ? `${defaultObj.label} (default)` : 'Default cohort'}</option>
                {cohorts.filter((c) => c.schema !== activeCohort).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 3 }}>Courses, categories, skills, session types, venues, settings, feedback questions and active faculty.</div>
            </div>
            <div>
              <label style={labelStyle}>Copy active students from (optional)</label>
              <select style={field} value={copyFromId} onChange={(e) => setCopyFromId(e.target.value)}>
                <option value="">Nobody</option>
                {cohorts.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Add students (optional)</label>
              <textarea
                style={{ ...field, minHeight: 90, fontFamily: 'monospace' }}
                value={studentInput}
                onChange={(e) => setStudentInput(e.target.value)}
                placeholder={'One per line: Name, email, enrollment no (optional)\nAsha Rao, asha23001@iiitd.ac.in'}
              />
              {studentInput && (
                <div style={{ fontSize: '0.72rem', marginTop: 3, color: parsedStudents.invalid.length ? '#b45309' : '#15803d' }}>
                  {parsedStudents.valid.length} valid{parsedStudents.invalid.length ? `, ${parsedStudents.invalid.length} line(s) will be skipped` : ''}
                </div>
              )}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: '#334155' }}>
              <input type="checkbox" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} />
              Make this the default cohort {runningCohorts.length > 0 && <span style={{ color: '#94a3b8' }}>(new sign-ups and background jobs)</span>}
            </label>

            {error && (
              <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderRadius: 8, background: '#fef2f2', color: '#b91c1c', fontSize: '0.82rem' }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={closeCreateModal} disabled={loading} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={loading} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#09090b', color: '#fff', fontWeight: 600, cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                {loading && <Loader2 size={14} className="spin" />} {loading ? 'Creating…' : 'Create cohort'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
