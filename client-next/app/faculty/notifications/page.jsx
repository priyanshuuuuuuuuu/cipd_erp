'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Send, Megaphone } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '@/lib/api';
import { formatDateTime } from '../components/PostCard';
import { PageHeader, Empty, Notice } from '../components/ui';

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
      <PageHeader icon={Megaphone} title="Notify Students" subtitle="Send an announcement to a module or a single class." />
      <form onSubmit={submit} className="fp-card">
        <div className="fp-card-head">New announcement</div>
        <div className="fp-card-body">
        <div className="fp-field-row">
          <div style={{ flex: '0 1 200px' }}>
            <label className="fp-label">Send to</label>
            <select className="fp-input" value={form.audience} onChange={(e) => set('audience', e.target.value)}>
              <option value="module">All students of a module</option>
              <option value="session">Students of a specific class</option>
            </select>
          </div>
          <div style={{ flex: '1 1 260px' }}>
            {form.audience === 'module' ? (
              <>
                <label className="fp-label">Module</label>
                <select className="fp-input" value={form.course_id} onChange={(e) => set('course_id', e.target.value)} required>
                  {modules.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.student_count} students)</option>)}
                </select>
              </>
            ) : (
              <>
                <label className="fp-label">Class</label>
                <select className="fp-input" value={form.session_id} onChange={(e) => set('session_id', e.target.value)} required>
                  <option value="">Select a class</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.date} {c.time} · {c.course}</option>)}
                </select>
              </>
            )}
          </div>
        </div>
        <div className="fp-field"><label className="fp-label">Title</label><input className="fp-input" maxLength={150} value={form.title} onChange={(e) => set('title', e.target.value)} required /></div>
        <div className="fp-field"><label className="fp-label">Message</label><textarea rows={4} maxLength={2000} className="fp-input" value={form.message} onChange={(e) => set('message', e.target.value)} required /></div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.84rem', fontWeight: 600, color: '#475569', display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={form.email} onChange={(e) => set('email', e.target.checked)} /> Also send by email</label>
          <div style={{ flex: 1 }} />
          <button disabled={busy || modules.length === 0} className="fp-btn fp-btn-primary"><Send size={14} /> {busy ? 'Sending…' : 'Send'}</button>
        </div>
        {modules.length === 0 && <div className="fp-hint">You have no modules yet, so there is nobody to notify.</div>}
        <Notice msg={msg} />
        </div>
      </form>

      <div className="fp-card">
        <div className="fp-card-head">Sent <span className="fp-count">{sent.length} total</span></div>
        {sent.length === 0 && <Empty icon={Megaphone} title="Nothing sent yet" />}
        {sent.map((n, i) => (
          <div key={i} className="fp-row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, width: '100%', flexWrap: 'wrap' }}>
              <b style={{ color: '#0f172a' }}>{n.title}</b>
              <span style={{ color: '#94a3b8', fontSize: '0.76rem' }}>{formatDateTime(n.created_at)} · {n.recipients} students</span>
            </div>
            <div style={{ color: '#475569', whiteSpace: 'pre-wrap' }}>{n.message}</div>
            <span className="fp-pill fp-pill-violet">{n.course_name}{n.session_title ? ` · ${n.session_title}` : ''}</span>
          </div>
        ))}
      </div>
    </>
  );
}
