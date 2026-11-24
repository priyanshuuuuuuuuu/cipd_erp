'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, MapPin, Clock, FileText, Link as LinkIcon, CheckCircle } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import { api } from '@/lib/api';
import { PageHeader, Loading, StatusPill, Empty } from '../../components/ui';
import { Calendar } from 'lucide-react';

const hhmm = (t) => (t ? String(t).slice(0, 5) : '');
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

  if (error) return <div className="fp-msg fp-msg-error">{error}</div>;
  if (!data) return <Loading />;
  const { session: s, roster, materials, change_requests: crs } = data;
  const hasPending = crs.some((c) => c.status === 'pending');

  const sub = { display: 'inline-flex', gap: 5, alignItems: 'center' };

  return (
    <>
      <button className="fp-link" style={{ marginBottom: 10 }} onClick={() => router.push('/faculty/schedule')}><ArrowLeft size={14} /> Schedule</button>
      <div className="fp-hero">
        <div>
          <p>{s.course_name}</p>
          <h2>{s.title}</h2>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: '0.88rem', marginTop: 10, opacity: 0.95 }}>
            <span style={sub}><Calendar size={14} />{s.date}</span>
            <span style={sub}><Clock size={14} />{hhmm(s.start)}–{hhmm(s.end)}</span>
            <span style={sub}><MapPin size={14} />{s.venue || 'TBA'}{s.building ? `, ${s.building}` : ''}</span>
          </div>
        </div>
        <div className="fp-hero-chip">
          <span>Status</span>
          <b style={{ textTransform: 'capitalize' }}>{s.status}</b>
        </div>
      </div>

      {msg && <div className={`fp-msg ${msg.startsWith('Request sent') ? 'fp-msg-ok' : 'fp-msg-error'}`} style={{ marginTop: 0, marginBottom: 16 }}>{msg}</div>}

      {s.status === 'scheduled' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
          <button className="fp-btn fp-btn-primary" disabled={busy} onClick={complete}><CheckCircle size={14} /> Mark completed</button>
          <button className="fp-btn" disabled={hasPending} onClick={() => setReq({ kind: 'reschedule', reason: '', date: s.date, start: hhmm(s.start), end: hhmm(s.end) })}>Request reschedule</button>
          <button className="fp-btn" style={{ color: '#dc2626' }} disabled={hasPending} onClick={() => setReq({ kind: 'cancel', reason: '' })}>Request cancellation</button>
          {hasPending && <span className="fp-pill fp-pill-amber" style={{ alignSelf: 'center' }}>A request is already pending</span>}
        </div>
      )}

      {req && (
        <form onSubmit={submitRequest} className="fp-card">
          <div className="fp-card-head">{req.kind === 'cancel' ? 'Request cancellation' : 'Request reschedule'}</div>
          <div className="fp-card-body">
            {req.kind === 'reschedule' && (
              <div className="fp-field-row">
                <div style={{ flex: '1 1 160px' }}><label className="fp-label">New date</label><input type="date" className="fp-input" value={req.date} onChange={(e) => setReq({ ...req, date: e.target.value })} required /></div>
                <div style={{ flex: '1 1 120px' }}><label className="fp-label">Start</label><input type="time" className="fp-input" value={req.start} onChange={(e) => setReq({ ...req, start: e.target.value })} required /></div>
                <div style={{ flex: '1 1 120px' }}><label className="fp-label">End</label><input type="time" className="fp-input" value={req.end} onChange={(e) => setReq({ ...req, end: e.target.value })} required /></div>
              </div>
            )}
            <div className="fp-field">
              <label className="fp-label">Reason</label>
              <textarea rows={3} className="fp-input" maxLength={1000} placeholder="Reason" value={req.reason} onChange={(e) => setReq({ ...req, reason: e.target.value })} required />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="fp-btn fp-btn-primary" disabled={busy}>Send to admin</button>
              <button type="button" className="fp-btn" onClick={() => setReq(null)}>Cancel</button>
            </div>
          </div>
        </form>
      )}

      {crs.length > 0 && (
        <div className="fp-card">
          <div className="fp-card-head">Requests for this class</div>
          {crs.map((c) => (
            <div key={c.id} className="fp-row">
              <div>
                <b style={{ textTransform: 'capitalize', color: '#0f172a' }}>{c.kind}</b>{c.kind === 'reschedule' ? ` → ${c.proposed_date} ${hhmm(c.proposed_start)}–${hhmm(c.proposed_end)}` : ''} <span style={{ color: '#64748b' }}>· {c.reason}</span>
                {c.admin_notes && <div style={{ color: '#94a3b8', fontSize: '0.76rem', marginTop: 3 }}>Admin: {c.admin_notes}</div>}
              </div>
              <StatusPill status={c.status} />
            </div>
          ))}
        </div>
      )}

      <div className="fp-card">
        <div className="fp-card-head">
          Materials tagged to this class
          <span className="fp-spacer" />
          {s.course_id && <button className="fp-btn fp-btn-sm" onClick={() => router.push(`/faculty/modules/${s.course_id}`)}>Open module</button>}
        </div>
        {materials.length === 0 && <Empty icon={FileText}>None yet. Post from the module page and tag this class.</Empty>}
        {materials.map((m) => (
          <div key={m.id} className="fp-row" style={{ justifyContent: 'flex-start' }}>
            {m.link_url ? <LinkIcon size={15} /> : <FileText size={15} />}
            {m.file_url || m.link_url ? <a href={m.file_url || m.link_url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontWeight: 600 }}>{m.title}</a> : m.title}
          </div>
        ))}
      </div>

      <div className="fp-card">
        <div className="fp-card-head">Roster <span className="fp-count">{roster.length} students</span></div>
        <div className="fp-table-wrap">
          <table className="fp-table">
            <thead><tr><th>Student</th><th>Enrollment</th></tr></thead>
            <tbody>
              {roster.map((r) => (
                <tr key={r.id}>
                  <td className="fp-strong">{r.name}</td>
                  <td className="fp-mono">{r.enrollment_no}</td>
                </tr>
              ))}
              {roster.length === 0 && <tr><td colSpan={2} style={{ textAlign: 'center', color: '#94a3b8', padding: '1.6rem' }}>No students enrolled.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
