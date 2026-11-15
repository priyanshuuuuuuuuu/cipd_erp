'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '@/lib/api';

const card = { background: '#fff', border: '1px solid #e8e8e8', borderRadius: 12, padding: '1rem 1.2rem', marginBottom: 14 };
const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: '0.85rem', fontFamily: 'inherit', boxSizing: 'border-box' };
const pill = (st) => ({ padding: '2px 9px', borderRadius: 8, fontSize: '0.72rem', fontWeight: 600, background: st === 'approved' ? '#dcfce7' : st === 'rejected' ? '#fee2e2' : '#fef9c3', color: st === 'approved' ? '#166534' : st === 'rejected' ? '#991b1b' : '#92400e' });
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
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1.2rem' }}>Leave</h1>
      <form onSubmit={submit} style={card}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Apply for leave</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          <div><label style={{ fontSize: '0.72rem', fontWeight: 600 }}>From</label><input type="date" style={inp} min={today()} value={form.from_date} onChange={(e) => setForm({ ...form, from_date: e.target.value, to_date: form.to_date < e.target.value ? e.target.value : form.to_date })} required /></div>
          <div><label style={{ fontSize: '0.72rem', fontWeight: 600 }}>To</label><input type="date" style={inp} min={form.from_date} value={form.to_date} onChange={(e) => setForm({ ...form, to_date: e.target.value })} required /></div>
        </div>
        <textarea rows={3} maxLength={1000} style={{ ...inp, resize: 'vertical', marginBottom: 10 }} placeholder="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required />
        <button disabled={busy} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#111', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Submit</button>
        {msg.text && <div style={{ marginTop: 10, fontSize: '0.82rem', color: msg.type === 'ok' ? '#166534' : '#b91c1c' }}>{msg.text}</div>}
        <div style={{ marginTop: 8, fontSize: '0.74rem', color: '#888' }}>Classes in this period are not cancelled automatically; the admin will arrange cover or ask you to request a reschedule.</div>
      </form>

      <div style={card}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>My requests</div>
        {list.length === 0 && <div style={{ color: '#aaa', fontSize: '0.85rem' }}>No leave requests yet.</div>}
        {list.map((l) => (
          <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderTop: '1px solid #f3f3f3', fontSize: '0.84rem' }}>
            <div>
              <b>{l.fromDate}{l.toDate !== l.fromDate ? ` → ${l.toDate}` : ''}</b> · {l.reason}
              {l.adminNotes && <div style={{ color: '#888', fontSize: '0.75rem' }}>Admin: {l.adminNotes}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={pill(l.status)}>{l.status}</span>
              {l.status === 'pending' && <button onClick={() => withdraw(l.id)} style={{ border: 'none', background: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: '0.75rem' }}>Withdraw</button>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
