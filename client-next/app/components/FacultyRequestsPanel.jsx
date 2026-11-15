'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

const badge = (status) => ({
  fontSize: '0.68rem', fontWeight: 700, padding: '4px 10px', borderRadius: 8,
  background: status === 'approved' ? '#ecfdf5' : status === 'rejected' ? '#fef2f2' : '#fffbeb',
  color: status === 'approved' ? '#166534' : status === 'rejected' ? '#991b1b' : '#b45309',
});
const card = { background: '#fff', borderRadius: 16, border: '1px solid #e8e8e8', padding: '1.1rem 1.4rem', marginBottom: 12 };
const hhmm = (t) => (t ? String(t).slice(0, 5) : '');

/** Admin: faculty session cancel/reschedule requests and faculty leave. Embedded in the Leave Requests page. */
export default function FacultyRequestsPanel() {
  const [data, setData] = useState({ changes: [], leave: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('changes');
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await api.get('/api/admin/faculty-requests?status=pending'));
      setError('');
    } catch (e) { setError(e.message || 'Failed to load'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const decide = async (kind, id, status) => {
    setBusy(id); setError('');
    try {
      await api.patch(`/api/admin/faculty-requests/${kind}/${id}`, { status, admin_notes: notes[id] || '' });
      await load();
    } catch (e) { setError(e.message || 'Failed to update'); } finally { setBusy(null); }
  };

  const tabBtn = (key, label, n) => (
    <button onClick={() => setTab(key)} style={{ padding: '8px 14px', borderRadius: 10, border: tab === key ? 'none' : '1px solid #e2e8f0', background: tab === key ? '#111' : '#fff', color: tab === key ? '#fff' : '#64748b', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
      {label}{n > 0 ? ` (${n})` : ''}
    </button>
  );
  const actions = (kind, id) => (
    <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      <input type="text" placeholder="Admin note (optional)" value={notes[id] || ''} onChange={(e) => setNotes((p) => ({ ...p, [id]: e.target.value }))}
        style={{ flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.82rem' }} />
      <button disabled={busy === id} onClick={() => decide(kind, id, 'approved')} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: '#166534', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.78rem' }}>Approve</button>
      <button disabled={busy === id} onClick={() => decide(kind, id, 'rejected')} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: '#991b1b', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.78rem' }}>Reject</button>
    </div>
  );

  return (
    <section style={{ marginTop: '2.5rem' }}>
      <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 12px' }}>Faculty requests (pending)</h2>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        {tabBtn('changes', 'Class changes', data.changes.length)}
        {tabBtn('leave', 'Faculty leave', data.leave.length)}
      </div>
      {error && <div style={{ color: '#b91c1c', fontSize: '0.82rem', marginBottom: 10 }}>{error}</div>}
      {loading && <div style={{ color: '#94a3b8', padding: 16 }}>Loading...</div>}

      {!loading && tab === 'changes' && (data.changes.length === 0
        ? <div style={{ ...card, textAlign: 'center', color: '#94a3b8', borderStyle: 'dashed' }}>No pending class change requests.</div>
        : data.changes.map((c) => (
          <div key={c.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{c.faculty_name || 'Faculty'} — {c.kind === 'cancel' ? 'cancel' : 'reschedule'} request</div>
                <div style={{ fontSize: '0.8rem', color: '#334155', marginTop: 6 }}>
                  {c.course_name || c.session_title} · <strong>{c.session_date}</strong> {hhmm(c.start_time)}–{hhmm(c.end_time)}
                  {c.kind === 'reschedule' && <> → <strong>{c.proposed_date}</strong> {hhmm(c.proposed_start)}–{hhmm(c.proposed_end)}</>}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 6 }}>{c.reason}</div>
              </div>
              <span style={badge(c.status)}>{c.status}</span>
            </div>
            {actions('change', c.id)}
          </div>
        )))}

      {!loading && tab === 'leave' && (data.leave.length === 0
        ? <div style={{ ...card, textAlign: 'center', color: '#94a3b8', borderStyle: 'dashed' }}>No pending faculty leave requests.</div>
        : data.leave.map((l) => (
          <div key={l.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{l.name || 'Faculty'}</div>
                <div style={{ fontSize: '0.8rem', color: '#334155', marginTop: 6 }}><strong>{l.from_date}</strong> to <strong>{l.to_date}</strong></div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 6 }}>{l.reason}</div>
                {l.affected_sessions.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: '0.76rem', color: '#92400e', background: '#fffbeb', borderRadius: 8, padding: '6px 10px' }}>
                    {l.affected_sessions.length} scheduled class{l.affected_sessions.length === 1 ? '' : 'es'} in this period need cover: {l.affected_sessions.map((s) => `${s.title} (${s.date})`).join(', ')}
                  </div>
                )}
              </div>
              <span style={badge(l.status)}>{l.status}</span>
            </div>
            {actions('leave', l.id)}
          </div>
        )))}
    </section>
  );
}
