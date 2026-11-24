'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Megaphone, FileText, Link as LinkIcon, ClipboardList, Paperclip, Pin, Trash2, Users, Loader2 } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import { api } from '@/lib/api';
import PostCard from '../../components/PostCard';
import { PageHeader, Loading, Empty } from '../../components/ui';

const TYPES = [
  { key: 'announcement', label: 'Announcement', icon: Megaphone },
  { key: 'material', label: 'Material', icon: FileText },
  { key: 'link', label: 'Link', icon: LinkIcon },
  { key: 'assignment', label: 'Assignment', icon: ClipboardList },
];

const EMPTY = { title: '', body: '', link_url: '', session_id: '', due_date: '', total_marks: '100', allow_late: true, pinned: false, email: false };

export default function FacultyModulePage() {
  const router = useRouter();
  const { courseId } = useParams();
  const { authReady } = useAuth();
  const [course, setCourse] = useState(null);
  const [posts, setPosts] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [type, setType] = useState('announcement');
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [flash, setFlash] = useState('');
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([
        api.get(`/api/faculty/modules/${courseId}/posts`),
        api.get('/api/faculty/schedule').catch(() => ({ sessions: [] })),
      ]);
      setCourse(p.course); setPosts(p.posts || []);
      setSessions((s.sessions || []).filter((x) => x.course_id === courseId));
      setError('');
    } catch (e) {
      setError(e.message || 'Failed to load module');
    } finally { setLoading(false); }
  }, [courseId]);

  useEffect(() => { if (authReady) load(); }, [authReady, load]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setFormError(''); setFlash('');
    if (!form.title.trim()) return setFormError('Title is required.');
    if (type === 'material' && !file) return setFormError('Attach a file.');
    if (type === 'link' && !form.link_url.trim()) return setFormError('Enter a link.');

    const fd = new FormData();
    fd.append('type', type);
    fd.append('title', form.title.trim());
    if (form.body.trim()) fd.append('body', form.body.trim());
    if (form.link_url.trim()) fd.append('link_url', form.link_url.trim());
    if (form.session_id) fd.append('session_id', form.session_id);
    if (file) fd.append('file', file);
    fd.append('pinned', String(form.pinned));
    fd.append('email', String(form.email));
    if (type === 'assignment') {
      if (form.due_date) fd.append('due_date', form.due_date);
      fd.append('total_marks', form.total_marks || '100');
      fd.append('allow_late', String(form.allow_late));
    }
    setSaving(true);
    try {
      const res = await api.upload(`/api/faculty/modules/${courseId}/posts`, fd);
      setForm(EMPTY); setFile(null); if (fileRef.current) fileRef.current.value = '';
      setFlash(`Posted. ${res.notified?.inApp || 0} students notified${res.notified?.emailQueued ? `, ${res.notified.emailQueued} emails queued` : ''}.`);
      await load();
    } catch (err) {
      setFormError(err.message || 'Failed to post');
    } finally { setSaving(false); }
  };

  const togglePin = async (p) => {
    try { await api.patch(`/api/faculty/posts/${p.id}`, { pinned: !p.pinned }); await load(); } catch (e) { setError(e.message); }
  };
  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.title}"?`)) return;
    try { await api.delete(`/api/faculty/posts/${p.id}`); await load(); } catch (e) { setError(e.message || 'Delete failed'); }
  };

  const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 6, borderRadius: 8 };

  if (loading) return <Loading />;
  if (error && !course) return <div className="fp-msg fp-msg-error">{error}</div>;

  return (
    <>
      <button className="fp-link" style={{ marginBottom: 10 }} onClick={() => router.push('/faculty/modules')}><ArrowLeft size={14} /> All modules</button>
      <PageHeader icon={ClipboardList} title={course?.name} subtitle={course?.code || undefined} />

      <form onSubmit={submit} className="fp-card fp-card-pad">
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {TYPES.map(({ key, label, icon: Icon }) => (
            <button key={key} type="button" onClick={() => setType(key)}
              className={`fp-btn ${type === key ? 'fp-btn-primary' : ''}`}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        <div className="fp-field">
          <label className="fp-label">Title</label>
          <input className="fp-input" value={form.title} maxLength={200} onChange={(e) => set('title', e.target.value)} placeholder={type === 'announcement' ? 'Announce something to your class' : 'Title'} />
        </div>
        <div className="fp-field">
          <label className="fp-label">{type === 'assignment' ? 'Instructions' : 'Details (optional)'}</label>
          <textarea className="fp-input" rows={3} maxLength={5000} value={form.body} onChange={(e) => set('body', e.target.value)} />
        </div>

        {(type === 'link' || type === 'assignment') && (
          <div className="fp-field">
            <label className="fp-label">Link {type === 'assignment' ? '(optional)' : ''}</label>
            <input className="fp-input" value={form.link_url} onChange={(e) => set('link_url', e.target.value)} placeholder="https://" />
          </div>
        )}

        {type === 'assignment' && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}><label className="fp-label">Due date</label><input type="datetime-local" className="fp-input" value={form.due_date} onChange={(e) => set('due_date', e.target.value)} /></div>
            <div style={{ flex: '0 1 120px' }}><label className="fp-label">Total marks</label><input type="number" min="1" max="1000" className="fp-input" value={form.total_marks} onChange={(e) => set('total_marks', e.target.value)} /></div>
            <label style={{ display: 'flex', alignItems: 'flex-end', gap: 6, fontSize: '0.8rem', paddingBottom: 9 }}><input type="checkbox" checked={form.allow_late} onChange={(e) => set('allow_late', e.target.checked)} /> Allow late submissions</label>
          </div>
        )}

        {type !== 'announcement' && type !== 'link' && (
          <div className="fp-field">
            <label className="fp-label">{type === 'material' ? 'File' : 'Attachment (optional)'}</label>
            <div onClick={() => fileRef.current?.click()} className="fp-drop" style={{ padding: '0.9rem', fontSize: '0.84rem', color: '#64748b' }}>
              <Paperclip size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />{file ? file.name : 'Click to select (PDF, DOC, PPT, PNG, JPG — max 10MB)'}
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>
          </div>
        )}

        {sessions.length > 0 && (
          <div className="fp-field">
            <label className="fp-label">Tag to a class (optional)</label>
            <select className="fp-input" value={form.session_id} onChange={(e) => set('session_id', e.target.value)}>
              <option value="">— None —</option>
              {sessions.map((s) => <option key={s.id} value={s.id}>{s.date} {s.time} · {s.title}</option>)}
            </select>
          </div>
        )}

        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
          <label style={{ fontSize: '0.84rem', fontWeight: 600, color: '#475569', display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={form.pinned} onChange={(e) => set('pinned', e.target.checked)} /> Pin to top</label>
          <label style={{ fontSize: '0.84rem', fontWeight: 600, color: '#475569', display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={form.email} onChange={(e) => set('email', e.target.checked)} /> Also email students</label>
          <div style={{ flex: 1 }} />
          <button type="submit" disabled={saving} className="fp-btn fp-btn-primary">
            {saving && <Loader2 size={14} style={{ animation: 'fp-spin 1s linear infinite' }} />} Post
          </button>
        </div>
        {formError && <div className="fp-msg fp-msg-error">{formError}</div>}
        {flash && <div className="fp-msg fp-msg-ok">{flash}</div>}
      </form>

      {error && <div className="fp-msg fp-msg-error" style={{ marginTop: 0, marginBottom: 12 }}>{error}</div>}
      {posts.length === 0 && <div className="fp-card"><Empty icon={Megaphone} title="Nothing posted yet">Use the form above to share your first post.</Empty></div>}
      {posts.map((p) => (
        <PostCard
          key={p.id}
          post={p}
          actions={!p.legacy && (
            <div style={{ display: 'flex', flexShrink: 0 }}>
              <button style={{ ...iconBtn, color: p.pinned ? '#111' : '#aaa' }} title={p.pinned ? 'Unpin' : 'Pin'} onClick={() => togglePin(p)}><Pin size={15} /></button>
              <button style={iconBtn} title="Delete" onClick={() => remove(p)}><Trash2 size={15} /></button>
            </div>
          )}
          footer={p.assignment && (
            <button onClick={() => router.push(`/faculty/modules/${courseId}/assignments/${p.assignment.id}`)}
              className="fp-btn fp-btn-sm fp-btn-soft" style={{ marginTop: 12 }}>
              <Users size={14} /> View submissions &amp; grade
            </button>
          )}
        />
      ))}
    </>
  );
}
