'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Send } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '@/lib/api';
import { formatDateTime } from '../components/PostCard';

const card = { background: '#fff', border: '1px solid #e8e8e8', borderRadius: 12, padding: '1rem 1.2rem', marginBottom: 14 };
const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: '0.85rem', fontFamily: 'inherit', boxSizing: 'border-box' };
const lbl = { fontSize: '0.75rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 };

export default function FacultyNotificationsPage() {
  const { authReady } = useAuth();
  const [modules, setModules] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sent, setSent] = useState([]);
  const [form, setForm] = useState({ audience: 'module', course_id: '', session_id: '', title: '', message: '', email: false });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const load = useCallback(async () => {
    const [m, s, h] = await Promise.allSettled([
      api.get('/api/faculty/modules'),
      api.get(`/api/faculty/schedule?upcoming=true`),
      api.get('/api/faculty/notifications'),
    ]);
    if (m.status === 'fulfilled') {
      setModules(m.value.modules || []);
      setForm((f) => (f.course_id || !m.value.modules?.length ? f : { ...f, course_id: m.value.modules[0].id }));
    }
    if (s.status === 'fulfilled') setClasses((s.value.sessions || []).filter((x) => x.course_id).slice(0, 50));
    if (h.status === 'fulfilled') setSent(h.value.sent || []);
  }, []);
  useEffect(() => { if (authReady) load(); }, [authReady, load]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg({ type: '', text: '' });
    try {
      const res = await api.post('/api/faculty/notifications', {
        audience: form.audience, title: form.title, message: form.message, email: form.email,
        ...(form.audience === 'module' ? { course_id: form.course_id } : { session_id: form.session_id }),
      });
      setMsg({ type: 'ok', text: `Sent to ${res.inApp} of ${res.audience} students${res.emailQueued ? `; ${res.emailQueued} emails queued` : ''}. (Students who turned off announcements are skipped.)` });
      setForm((f) => ({ ...f, title: '', message: '' }));
      await load();
    } catch (err) { setMsg({ type: 'error', text: err.message || 'Failed to send' }); } finally { setBusy(false); }
  };

  return (
    <>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1.2rem' }}>Notify Students</h1>
      <form onSubmit={submit} style={card}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          <div style={{ flex: '0 1 200px' }}>
            <label style={lbl}>Send to</label>
            <select style={inp} value={form.audience} onChange={(e) => set('audience', e.target.value)}>
              <option value="module">All students of a module</option>
              <option value="session">Students of a specific class</option>
            </select>
          </div>
          <div style={{ flex: '1 1 260px' }}>
            {form.audience === 'module' ? (
              <>
                <label style={lbl}>Module</label>
                <select style={inp} value={form.course_id} onChange={(e) => set('course_id', e.target.value)} required>
                  {modules.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.student_count} students)</option>)}
                </select>
              </>
            ) : (
              <>
                <label style={lbl}>Class</label>
                <select style={inp} value={form.session_id} onChange={(e) => set('session_id', e.target.value)} required>
                  <option value="">Select a class</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.date} {c.time} · {c.course}</option>)}
                </select>
              </>
            )}
          </div>
        </div>
        <div style={{ marginBottom: 10 }}><label style={lbl}>Title</label><input style={inp} maxLength={150} value={form.title} onChange={(e) => set('title', e.target.value)} required /></div>
        <div style={{ marginBottom: 10 }}><label style={lbl}>Message</label><textarea rows={4} maxLength={2000} style={{ ...inp, resize: 'vertical' }} value={form.message} onChange={(e) => set('message', e.target.value)} required /></div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.8rem', display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={form.email} onChange={(e) => set('email', e.target.checked)} /> Also send by email</label>
          <div style={{ flex: 1 }} />
          <button disabled={busy || modules.length === 0} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#111', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', gap: 6, alignItems: 'center' }}><Send size={14} /> Send</button>
        </div>
        {modules.length === 0 && <div style={{ marginTop: 10, fontSize: '0.8rem', color: '#888' }}>You have no modules yet, so there is nobody to notify.</div>}
        {msg.text && <div style={{ marginTop: 10, fontSize: '0.82rem', color: msg.type === 'ok' ? '#166534' : '#b91c1c' }}>{msg.text}</div>}
      </form>

      <div style={card}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Sent</div>
        {sent.length === 0 && <div style={{ color: '#aaa', fontSize: '0.85rem' }}>Nothing sent yet.</div>}
        {sent.map((n, i) => (
          <div key={i} style={{ borderTop: '1px solid #f3f3f3', padding: '8px 0', fontSize: '0.84rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><b>{n.title}</b><span style={{ color: '#888', fontSize: '0.74rem' }}>{formatDateTime(n.created_at)} · {n.recipients} students</span></div>
            <div style={{ color: '#555', whiteSpace: 'pre-wrap' }}>{n.message}</div>
            <div style={{ color: '#aaa', fontSize: '0.72rem' }}>{n.course_name}{n.session_title ? ` · ${n.session_title}` : ''}</div>
          </div>
        ))}
      </div>
    </>
  );
}
