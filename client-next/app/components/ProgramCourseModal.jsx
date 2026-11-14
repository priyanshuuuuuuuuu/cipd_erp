'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, BookOpen, Loader2, Plus, Trash2, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useCohort } from '../contexts/CohortContext';

const emptyCourse = () => ({ name: '', code: '', description: '' });
const input = {
  width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid #d1d5db',
  fontSize: '0.84rem', boxSizing: 'border-box', background: '#fff', fontFamily: 'inherit',
};
const label = {
  display: 'block', fontSize: '0.68rem', fontWeight: 700, color: '#64748b',
  marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px',
};

/** Create a program with courses, or add courses to an existing program. */
export default function ProgramCourseModal({
  program = null,
  cohortSchema,
  cohortLabel,
  onClose,
  onSaved,
}) {
  const { selectedCohort, selectedCohortObj } = useCohort();
  const [programName, setProgramName] = useState('');
  const [courses, setCourses] = useState([emptyCourse()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const targetSchema = cohortSchema || selectedCohort;
  const targetLabel = cohortLabel || selectedCohortObj?.label || targetSchema;
  const adding = !!program;

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const updateCourse = (index, field, value) => {
    setCourses((current) => current.map((course, i) => i === index ? { ...course, [field]: value } : course));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!targetSchema) return setError('Select a cohort first.');
    if (!adding && !programName.trim()) return setError('Program name is required.');
    if (courses.some((course) => !course.name.trim() || !course.code.trim())) {
      return setError('Every course needs a name and code.');
    }

    try {
      setSaving(true);
      const path = adding ? `/api/admin/programs/${program.id}/courses` : '/api/admin/programs';
      const body = adding
        ? { courses }
        : { name: programName.trim(), courses };
      const result = await apiFetch(path, {
        method: 'POST',
        headers: { 'x-cohort': targetSchema },
        body: JSON.stringify(body),
      });
      await onSaved?.(result);
    } catch (err) {
      setError(err.message || 'Could not save the program and courses.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 12000, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: 'min(720px, 96vw)', maxHeight: '92vh', background: '#fff', borderRadius: 16, boxShadow: '0 25px 70px rgba(0,0,0,0.3)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg,#0f172a,#334155)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BookOpen size={20} />
            <div>
              <div style={{ fontWeight: 800 }}>{adding ? `Add courses to ${program.name}` : 'Create program and courses'}</div>
              <div style={{ fontSize: '0.7rem', color: '#cbd5e1', marginTop: 2 }}>Courses will be created in {targetLabel || 'the selected cohort'}</div>
            </div>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} disabled={saving} style={{ border: 0, background: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: 8, padding: 6, display: 'flex', cursor: 'pointer' }}><X size={17} /></button>
        </div>

        <form onSubmit={submit} style={{ padding: 20, overflowY: 'auto' }}>
          {!adding && (
            <div style={{ marginBottom: 18 }}>
              <label style={label}>Program name *</label>
              <input style={input} value={programName} onChange={(e) => setProgramName(e.target.value)} placeholder="e.g. iPD-CP" autoFocus />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a' }}>Courses</div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Add one or more courses. Codes must be unique in this cohort.</div>
            </div>
            <button type="button" onClick={() => setCourses((current) => [...current, emptyCourse()])} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}><Plus size={13} /> Add course</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {courses.map((course, index) => (
              <div key={index} style={{ padding: 12, border: '1px solid #e2e8f0', borderRadius: 10, background: '#f8fafc' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(120px, 0.7fr) auto', gap: 9, alignItems: 'end' }}>
                  <div><label style={label}>Course name *</label><input style={input} value={course.name} onChange={(e) => updateCourse(index, 'name', e.target.value)} placeholder="Product Design" /></div>
                  <div><label style={label}>Code *</label><input style={{ ...input, fontFamily: 'monospace', textTransform: 'uppercase' }} value={course.code} onChange={(e) => updateCourse(index, 'code', e.target.value.toUpperCase())} placeholder="PD101" /></div>
                  <button type="button" aria-label={`Remove course ${index + 1}`} disabled={courses.length === 1} onClick={() => setCourses((current) => current.filter((_, i) => i !== index))} style={{ height: 37, width: 37, borderRadius: 8, border: '1px solid #fecaca', background: '#fff', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: courses.length === 1 ? 'not-allowed' : 'pointer', opacity: courses.length === 1 ? 0.4 : 1 }}><Trash2 size={14} /></button>
                </div>
                <div style={{ marginTop: 9 }}><label style={label}>Description (optional)</label><textarea style={{ ...input, minHeight: 58, resize: 'vertical' }} value={course.description} onChange={(e) => updateCourse(index, 'description', e.target.value)} placeholder="Short course description" /></div>
              </div>
            ))}
          </div>

          {error && <div style={{ display: 'flex', gap: 8, marginTop: 12, padding: '10px 12px', borderRadius: 8, background: '#fef2f2', color: '#b91c1c', fontSize: '0.78rem' }}><AlertCircle size={15} style={{ flexShrink: 0 }} /> {error}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
            <button type="button" onClick={onClose} disabled={saving} style={{ padding: '9px 15px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: '9px 16px', borderRadius: 8, border: 0, background: '#0f172a', color: '#fff', cursor: saving ? 'wait' : 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              {saving && <Loader2 size={14} className="spin" />} {saving ? 'Saving…' : adding ? 'Add courses' : 'Create program'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
