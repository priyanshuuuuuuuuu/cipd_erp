'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';

/** Admin: choose which faculty teach a module. Faculty with sessions in the module keep access regardless. */
export default function CourseFacultyModal({ course, onClose, readOnly }) {
  const [list, setList] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api.get(`/api/admin/courses/${course.id}/faculty`)
      .then((d) => {
        if (!alive) return;
        setList(d.faculty || []);
        setSelected(new Set((d.faculty || []).filter((f) => f.assigned).map((f) => f.id)));
      })
      .catch((e) => alive && setError(e.message || 'Could not load faculty'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [course.id]);

  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const save = async () => {
    setSaving(true); setError('');
    try {
      await api.put(`/api/admin/courses/${course.id}/faculty`, { faculty_ids: [...selected] });
      onClose(true);
    } catch (e) {
      setError(e.message || 'Could not save');
    } finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => onClose(false)}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 460, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '18px 20px 10px' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Assign faculty</div>
          <div style={{ fontSize: '1rem', fontWeight: 800 }}>{course.name}</div>
          <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 4 }}>Assigned faculty can post announcements, materials and assignments for this module.</div>
        </div>
        <div style={{ padding: '0 20px', overflowY: 'auto', flex: 1 }}>
          {loading && <div style={{ padding: 20, color: '#94a3b8' }}>Loading…</div>}
          {!loading && list.length === 0 && <div style={{ padding: 20, color: '#94a3b8' }}>No faculty in this cohort yet.</div>}
          {list.map((f) => (
            <label key={f.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f1f5f9', cursor: readOnly ? 'default' : 'pointer' }}>
              <input type="checkbox" disabled={readOnly} checked={selected.has(f.id)} onChange={() => toggle(f.id)} />
              <span>
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{f.first_name} {f.last_name}</span>
                <span style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8' }}>{f.designation || f.email}</span>
              </span>
            </label>
          ))}
        </div>
        {error && <div style={{ color: '#b91c1c', fontSize: '0.8rem', padding: '8px 20px 0' }}>{error}</div>}
        <div style={{ padding: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={() => onClose(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}>Cancel</button>
          {!readOnly && <button onClick={save} disabled={saving || loading} style={{ padding: '8px 16px', borderRadius: 8, border: 0, background: '#0f172a', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>{saving ? 'Saving…' : 'Save'}</button>}
        </div>
      </div>
    </div>
  );
}
