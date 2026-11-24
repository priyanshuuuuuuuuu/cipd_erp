'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { CalendarOff } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader, Empty, StatusPill, Notice } from '../components/ui';

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export default function FacultyLeavePage() {
  const { authReady } = useAuth();
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ from_date: today(), to_date: today(), reason: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const load = useCallback(async () => {
    try { setList((await api.get('/api/faculty/leave')).leave || []); } catch (e) { setMsg({ type: 'error', text: e.message }); }
  }, []);
  useEffect(() => { if (authReady) load(); }, [authReady, load]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg({ type: '', text: '' });
    try {
      await api.post('/api/faculty/leave', form);
      setForm({ from_date: today(), to_date: today(), reason: '' });
      setMsg({ type: 'ok', text: 'Leave request sent to the admin.' });
      await load();
    } catch (err) { setMsg({ type: 'error', text: err.message || 'Failed' }); } finally { setBusy(false); }
  };
  const withdraw = async (id) => {
    try { await api.delete(`/api/faculty/leave?id=${id}`); await load(); } catch (e) { setMsg({ type: 'error', text: e.message }); }
  };

  return (
    <>
      <PageHeader icon={CalendarOff} title="Leave" subtitle="Apply for time off and track your requests." />
      <form onSubmit={submit} className="fp-card">
        <div className="fp-card-head">Apply for leave</div>
        <div className="fp-card-body">
          <div className="fp-field-row">
            <div style={{ flex: '1 1 180px' }}>
              <label className="fp-label">From</label>
              <input type="date" className="fp-input" min={today()} value={form.from_date} onChange={(e) => setForm({ ...form, from_date: e.target.value, to_date: form.to_date < e.target.value ? e.target.value : form.to_date })} required />
            </div>
            <div style={{ flex: '1 1 180px' }}>
              <label className="fp-label">To</label>
              <input type="date" className="fp-input" min={form.from_date} value={form.to_date} onChange={(e) => setForm({ ...form, to_date: e.target.value })} required />
            </div>
          </div>
          <div className="fp-field">
            <label className="fp-label">Reason</label>
            <textarea rows={3} maxLength={1000} className="fp-input" placeholder="Briefly describe the reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required />
          </div>
          <button disabled={busy} className="fp-btn fp-btn-primary">{busy ? 'Submitting…' : 'Submit request'}</button>
          <Notice msg={msg} />
          <div className="fp-hint">Classes in this period are not cancelled automatically; the admin will arrange cover or ask you to request a reschedule.</div>
        </div>
      </form>

      <div className="fp-card">
        <div className="fp-card-head">My requests <span className="fp-count">{list.length} total</span></div>
        {list.length === 0 && <Empty icon={CalendarOff} title="No leave requests yet" />}
        {list.map((l) => (
          <div key={l.id} className="fp-row">
            <div>
              <b style={{ color: '#0f172a' }}>{l.fromDate}{l.toDate !== l.fromDate ? ` → ${l.toDate}` : ''}</b>
              <span style={{ color: '#64748b' }}> · {l.reason}</span>
              {l.adminNotes && <div style={{ color: '#94a3b8', fontSize: '0.76rem', marginTop: 3 }}>Admin: {l.adminNotes}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <StatusPill status={l.status} />
              {l.status === 'pending' && <button className="fp-btn fp-btn-danger fp-btn-sm" onClick={() => withdraw(l.id)}>Withdraw</button>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
