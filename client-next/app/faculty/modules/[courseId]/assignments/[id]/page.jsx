'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, FileText, Check } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../../../contexts/AuthContext';
import { api } from '@/lib/api';
import { formatDateTime } from '../../../../components/PostCard';

export default function AssignmentGradingPage() {
  const router = useRouter();
  const { courseId, id } = useParams();
  const { authReady } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState({}); // submissionId -> { grade, feedback }
  const [saving, setSaving] = useState({});
  const [msg, setMsg] = useState({});

  const load = useCallback(async () => {
    try {
      const d = await api.get(`/api/faculty/assignments/${id}/submissions`);
      setData(d);
      const init = {};
      d.students.forEach((s) => { if (s.submission) init[s.submission.id] = { grade: s.submission.grade ?? '', feedback: s.submission.feedback || '' }; });
      setDrafts(init);
    } catch (e) { setError(e.message || 'Failed to load submissions'); }
  }, [id]);

  useEffect(() => { if (authReady) load(); }, [authReady, load]);

  const save = async (sub) => {
    const d = drafts[sub.id];
    setSaving((s) => ({ ...s, [sub.id]: true })); setMsg((m) => ({ ...m, [sub.id]: '' }));
    try {
      await api.patch(`/api/faculty/assignments/${id}/submissions/${sub.id}`, {
        grade: d.grade === '' ? null : Number(d.grade),
        feedback: d.feedback,
      });
      setMsg((m) => ({ ...m, [sub.id]: 'Saved' }));
      await load();
    } catch (e) {
      setMsg((m) => ({ ...m, [sub.id]: e.message || 'Failed' }));
    } finally { setSaving((s) => ({ ...s, [sub.id]: false })); }
  };

  if (error) return <div style={{ color: '#dc2626' }}>{error}</div>;
  if (!data) return <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>Loading...</div>;
  const { assignment: a, students, summary } = data;
  const inp = { padding: '6px 8px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: '0.82rem', fontFamily: 'inherit', boxSizing: 'border-box' };

  return (
    <>
      <button onClick={() => router.push(`/faculty/modules/${courseId}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', marginBottom: 8 }}><ArrowLeft size={14} /> Back to module</button>
      <h1 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0 0 4px' }}>{a.title}</h1>
      <div style={{ fontSize: '0.8rem', color: '#777', marginBottom: 16 }}>
        {a.course_name} · {a.due_date ? `Due ${formatDateTime(a.due_date)}` : 'No due date'} · {a.total_marks} marks ·
        {' '}{summary.submitted}/{summary.enrolled} submitted · {summary.graded} graded
      </div>

      <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#888', fontSize: '0.72rem', textTransform: 'uppercase' }}>
              <th style={{ padding: '10px 14px' }}>Student</th><th style={{ padding: '10px 14px' }}>Submission</th>
              <th style={{ padding: '10px 14px' }}>Marks / {a.total_marks}</th><th style={{ padding: '10px 14px' }}>Feedback</th><th />
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const sub = s.submission;
              const d = sub ? drafts[sub.id] : null;
              return (
                <tr key={s.student_id} style={{ borderTop: '1px solid #f3f3f3', verticalAlign: 'top' }}>
                  <td style={{ padding: '10px 14px' }}><div style={{ fontWeight: 600 }}>{s.name}</div><div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#888' }}>{s.enrollment_no}</div></td>
                  <td style={{ padding: '10px 14px' }}>
                    {sub ? (
                      <>
                        {sub.file_url && <a href={sub.file_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', gap: 5, alignItems: 'center', color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}><FileText size={14} /> Open</a>}
                        <div style={{ fontSize: '0.72rem', color: sub.late ? '#dc2626' : '#888' }}>{formatDateTime(sub.submitted_at)}{sub.late ? ' · late' : ''}</div>
                      </>
                    ) : <span style={{ color: '#bbb' }}>Not submitted</span>}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {sub && <input type="number" min="0" max={a.total_marks} step="0.5" style={{ ...inp, width: 80 }} value={d?.grade ?? ''} onChange={(e) => setDrafts((x) => ({ ...x, [sub.id]: { ...x[sub.id], grade: e.target.value } }))} />}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {sub && <textarea rows={2} maxLength={2000} style={{ ...inp, width: '100%', minWidth: 180, resize: 'vertical' }} value={d?.feedback ?? ''} onChange={(e) => setDrafts((x) => ({ ...x, [sub.id]: { ...x[sub.id], feedback: e.target.value } }))} />}
                  </td>
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                    {sub && (
                      <>
                        <button disabled={saving[sub.id]} onClick={() => save(sub)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#111', color: '#fff', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer', display: 'inline-flex', gap: 4, alignItems: 'center' }}><Check size={13} /> Save</button>
                        <div style={{ fontSize: '0.7rem', color: msg[sub.id] === 'Saved' ? '#16a34a' : '#dc2626', marginTop: 3 }}>{msg[sub.id]}</div>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {students.length === 0 && <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#aaa' }}>No students enrolled.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
