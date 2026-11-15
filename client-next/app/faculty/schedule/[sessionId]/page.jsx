'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, MapPin, Clock, FileText, Link as LinkIcon, CheckCircle } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import { api } from '@/lib/api';

const card = { background: '#fff', border: '1px solid #e8e8e8', borderRadius: 12, padding: '1rem 1.2rem', marginBottom: 14 };
const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: '0.85rem', fontFamily: 'inherit', boxSizing: 'border-box' };
const btn = { padding: '8px 16px', borderRadius: 8, border: 'none', background: '#111', color: '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' };
const hhmm = (t) => (t ? String(t).slice(0, 5) : '');
const pill = (st) => ({ padding: '2px 9px', borderRadius: 8, fontSize: '0.72rem', fontWeight: 600, background: st === 'approved' ? '#dcfce7' : st === 'rejected' ? '#fee2e2' : '#fef9c3', color: st === 'approved' ? '#166534' : st === 'rejected' ? '#991b1b' : '#92400e' });

export default function FacultyClassDetailPage() {
  const router = useRouter();
  const { sessionId } = useParams();
  const { authReady } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [req, setReq] = useState(null); // { kind, reason, date, start, end }

  const load = useCallback(async () => {
    try { setData(await api.get(`/api/faculty/sessions/${sessionId}`)); setError(''); }
    catch (e) { setError(e.message || 'Failed to load class'); }
  }, [sessionId]);
  useEffect(() => { if (authReady) load(); }, [authReady, load]);

  const complete = async () => {
    if (!window.confirm('Mark this class as completed? This counts towards your hours and honorarium.')) return;
    setBusy(true); setMsg('');
    try { await api.patch(`/api/faculty/sessions/${sessionId}`, { action: 'complete' }); await load(); }
    catch (e) { setMsg(e.message || 'Failed'); } finally { setBusy(false); }
  };

  const submitRequest = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg('');
    try {
      await api.post('/api/faculty/change-requests', {
        session_id: sessionId, kind: req.kind, reason: req.reason,
        ...(req.kind === 'reschedule' ? { proposed_date: req.date, proposed_start: req.start, proposed_end: req.end } : {}),
      });
      setReq(null); setMsg('Request sent to the admin.'); await load();
    } catch (err) { setMsg(err.message || 'Failed to send request'); } finally { setBusy(false); }
  };

  if (error) return <div style={{ color: '#dc2626' }}>{error}</div>;
  if (!data) return <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>Loading...</div>;
  const { session: s, roster, materials, change_requests: crs } = data;
  const hasPending = crs.some((c) => c.status === 'pending');

  return (
    <>
      <button onClick={() => router.push('/faculty/schedule')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', marginBottom: 8 }}><ArrowLeft size={14} /> Schedule</button>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 6px' }}>{s.title}</h1>
      <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: 16, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <span>{s.course_name}</span>
        <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Clock size={13} />{s.date} · {hhmm(s.start)}–{hhmm(s.end)}</span>
        <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><MapPin size={13} />{s.venue || 'TBA'}{s.building ? `, ${s.building}` : ''}</span>
        <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{s.status}</span>
      </div>

      {msg && <div style={{ ...card, color: msg.startsWith('Request sent') ? '#166534' : '#b91c1c', padding: '10px 14px' }}>{msg}</div>}

      {s.status === 'scheduled' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <button style={btn} disabled={busy} onClick={complete}><CheckCircle size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Mark completed</button>
          <button style={{ ...btn, background: '#fff', color: '#111', border: '1px solid #e5e7eb' }} disabled={hasPending} onClick={() => setReq({ kind: 'reschedule', reason: '', date: s.date, start: hhmm(s.start), end: hhmm(s.end) })}>Request reschedule</button>
          <button style={{ ...btn, background: '#fff', color: '#b91c1c', border: '1px solid #fecaca' }} disabled={hasPending} onClick={() => setReq({ kind: 'cancel', reason: '' })}>Request cancellation</button>
          {hasPending && <span style={{ fontSize: '0.75rem', color: '#92400e', alignSelf: 'center' }}>A request is already pending.</span>}
        </div>
      )}

      {req && (
        <form onSubmit={submitRequest} style={card}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>{req.kind === 'cancel' ? 'Request cancellation' : 'Request reschedule'}</div>
          {req.kind === 'reschedule' && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
              <div><label style={{ fontSize: '0.72rem', fontWeight: 600 }}>New date</label><input type="date" style={inp} value={req.date} onChange={(e) => setReq({ ...req, date: e.target.value })} required /></div>
              <div><label style={{ fontSize: '0.72rem', fontWeight: 600 }}>Start</label><input type="time" style={inp} value={req.start} onChange={(e) => setReq({ ...req, start: e.target.value })} required /></div>
              <div><label style={{ fontSize: '0.72rem', fontWeight: 600 }}>End</label><input type="time" style={inp} value={req.end} onChange={(e) => setReq({ ...req, end: e.target.value })} required /></div>
            </div>
          )}
          <textarea rows={3} style={{ ...inp, resize: 'vertical', marginBottom: 10 }} maxLength={1000} placeholder="Reason" value={req.reason} onChange={(e) => setReq({ ...req, reason: e.target.value })} required />
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btn} disabled={busy}>Send to admin</button>
            <button type="button" style={{ ...btn, background: '#fff', color: '#111', border: '1px solid #e5e7eb' }} onClick={() => setReq(null)}>Cancel</button>
          </div>
        </form>
      )}

      {crs.length > 0 && (
        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Requests for this class</div>
          {crs.map((c) => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '6px 0', borderTop: '1px solid #f3f3f3', fontSize: '0.82rem' }}>
              <div>
                <b>{c.kind}</b>{c.kind === 'reschedule' ? ` → ${c.proposed_date} ${hhmm(c.proposed_start)}–${hhmm(c.proposed_end)}` : ''} · {c.reason}
                {c.admin_notes && <div style={{ color: '#888', fontSize: '0.75rem' }}>Admin: {c.admin_notes}</div>}
              </div>
              <span style={pill(c.status)}>{c.status}</span>
            </div>
          ))}
        </div>
      )}

      <div style={card}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Materials tagged to this class</div>
        {materials.length === 0 && <div style={{ color: '#aaa', fontSize: '0.82rem' }}>None yet. Post from the module page and tag this class.</div>}
        {materials.map((m) => (
          <div key={m.id} style={{ padding: '6px 0', fontSize: '0.85rem', display: 'flex', gap: 8, alignItems: 'center' }}>
            {m.link_url ? <LinkIcon size={14} /> : <FileText size={14} />}
            {m.file_url || m.link_url ? <a href={m.file_url || m.link_url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>{m.title}</a> : m.title}
          </div>
        ))}
        {s.course_id && <button onClick={() => router.push(`/faculty/modules/${s.course_id}`)} style={{ ...btn, marginTop: 8, background: '#fff', color: '#111', border: '1px solid #e5e7eb' }}>Open module</button>}
      </div>

      <div style={card}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Roster ({roster.length})</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
            <tbody>
              {roster.map((r) => (
                <tr key={r.id} style={{ borderTop: '1px solid #f3f3f3' }}>
                  <td style={{ padding: '6px 8px', fontWeight: 600 }}>{r.name}</td>
                  <td style={{ padding: '6px 8px', fontFamily: 'monospace', color: '#666' }}>{r.enrollment_no}</td>
                </tr>
              ))}
              {roster.length === 0 && <tr><td style={{ color: '#aaa', padding: 8 }}>No students enrolled.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
