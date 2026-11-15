'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Megaphone, FileText, Link as LinkIcon, ClipboardList, Paperclip, Pin, Trash2, Users, Loader2 } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import { api } from '@/lib/api';
import PostCard from '../../components/PostCard';

const TYPES = [
  { key: 'announcement', label: 'Announcement', icon: Megaphone },
  { key: 'material', label: 'Material', icon: FileText },
  { key: 'link', label: 'Link', icon: LinkIcon },
  { key: 'assignment', label: 'Assignment', icon: ClipboardList },
];

const inp = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: '0.85rem', fontFamily: 'inherit', boxSizing: 'border-box' };
const lbl = { fontSize: '0.75rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 };
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

  const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: 4 };

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>Loading...</div>;
  if (error && !course) return <div style={{ color: '#dc2626' }}>{error}</div>;

  return (
    <>
      <button onClick={() => router.push('/faculty/modules')} style={{ ...iconBtn, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', marginBottom: 8 }}><ArrowLeft size={14} /> All modules</button>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#111', margin: '0 0 1.2rem' }}>{course?.name}{course?.code ? <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#888', marginLeft: 10 }}>{course.code}</span> : null}</h1>

      <form onSubmit={submit} style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 12, padding: '1rem 1.2rem', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {TYPES.map(({ key, label, icon: Icon }) => (
            <button key={key} type="button" onClick={() => setType(key)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', border: `1px solid ${type === key ? '#111' : '#e5e7eb'}`, background: type === key ? '#111' : '#fff', color: type === key ? '#fff' : '#555' }}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={lbl}>Title</label>
          <input style={inp} value={form.title} maxLength={200} onChange={(e) => set('title', e.target.value)} placeholder={type === 'announcement' ? 'Announce something to your class' : 'Title'} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={lbl}>{type === 'assignment' ? 'Instructions' : 'Details (optional)'}</label>
          <textarea style={{ ...inp, resize: 'vertical' }} rows={3} maxLength={5000} value={form.body} onChange={(e) => set('body', e.target.value)} />
        </div>

        {(type === 'link' || type === 'assignment') && (
          <div style={{ marginBottom: 10 }}>
            <label style={lbl}>Link {type === 'assignment' ? '(optional)' : ''}</label>
            <input style={inp} value={form.link_url} onChange={(e) => set('link_url', e.target.value)} placeholder="https://" />
          </div>
        )}

        {type === 'assignment' && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}><label style={lbl}>Due date</label><input type="datetime-local" style={inp} value={form.due_date} onChange={(e) => set('due_date', e.target.value)} /></div>
            <div style={{ flex: '0 1 120px' }}><label style={lbl}>Total marks</label><input type="number" min="1" max="1000" style={inp} value={form.total_marks} onChange={(e) => set('total_marks', e.target.value)} /></div>
            <label style={{ display: 'flex', alignItems: 'flex-end', gap: 6, fontSize: '0.8rem', paddingBottom: 9 }}><input type="checkbox" checked={form.allow_late} onChange={(e) => set('allow_late', e.target.checked)} /> Allow late submissions</label>
          </div>
        )}

        {type !== 'announcement' && type !== 'link' && (
          <div style={{ marginBottom: 10 }}>
            <label style={lbl}>{type === 'material' ? 'File' : 'Attachment (optional)'}</label>
            <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed #e0e0e0', borderRadius: 10, padding: '0.9rem', textAlign: 'center', cursor: 'pointer', background: '#fafafa', fontSize: '0.82rem', color: '#888' }}>
              <Paperclip size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />{file ? file.name : 'Click to select (PDF, DOC, PPT, PNG, JPG — max 10MB)'}
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>
          </div>
        )}

        {sessions.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <label style={lbl}>Tag to a class (optional)</label>
            <select style={inp} value={form.session_id} onChange={(e) => set('session_id', e.target.value)}>
              <option value="">— None —</option>
              {sessions.map((s) => <option key={s.id} value={s.id}>{s.date} {s.time} · {s.title}</option>)}
            </select>
          </div>
        )}

        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
          <label style={{ fontSize: '0.8rem', display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={form.pinned} onChange={(e) => set('pinned', e.target.checked)} /> Pin to top</label>
          <label style={{ fontSize: '0.8rem', display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={form.email} onChange={(e) => set('email', e.target.checked)} /> Also email students</label>
          <div style={{ flex: 1 }} />
          <button type="submit" disabled={saving} style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: '#111', color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', gap: 6, alignItems: 'center' }}>
            {saving && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />} Post
          </button>
        </div>
        {formError && <div style={{ color: '#dc2626', fontSize: '0.82rem', marginTop: 10 }}>{formError}</div>}
        {flash && <div style={{ color: '#16a34a', fontSize: '0.82rem', marginTop: 10 }}>{flash}</div>}
      </form>

      {error && <div style={{ color: '#dc2626', marginBottom: 10 }}>{error}</div>}
      {posts.length === 0 && <div style={{ textAlign: 'center', color: '#aaa', padding: '2rem' }}>Nothing posted yet.</div>}
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
              style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600, border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
              <Users size={14} /> View submissions &amp; grade
            </button>
          )}
        />
      ))}
    </>
  );
}
