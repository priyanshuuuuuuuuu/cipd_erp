'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, FileText, Check } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../../../contexts/AuthContext';
import { api } from '@/lib/api';
import { formatDateTime } from '../../../../components/PostCard';
import { PageHeader, Loading, StatTile } from '../../../../components/ui';
import { ClipboardList, Users, CheckCircle2 } from 'lucide-react';

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

  if (error) return <div className="fp-msg fp-msg-error">{error}</div>;
  if (!data) return <Loading />;
  const { assignment: a, students, summary } = data;

  return (
    <>
      <button className="fp-link" style={{ marginBottom: 10 }} onClick={() => router.push(`/faculty/modules/${courseId}`)}><ArrowLeft size={14} /> Back to module</button>
      <PageHeader
        icon={ClipboardList}
        title={a.title}
        subtitle={`${a.course_name} · ${a.due_date ? `Due ${formatDateTime(a.due_date)}` : 'No due date'} · ${a.total_marks} marks`}
      />
      <div className="fp-stats">
        <StatTile label="Enrolled" value={summary.enrolled} icon={Users} tone="blue" />
        <StatTile label="Submitted" value={summary.submitted} icon={FileText} tone="amber" />
        <StatTile label="Graded" value={summary.graded} icon={CheckCircle2} tone="green" />
      </div>

      <div className="fp-card fp-table-wrap">
        <table className="fp-table">
          <thead>
            <tr><th>Student</th><th>Submission</th><th>Marks / {a.total_marks}</th><th>Feedback</th><th /></tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const sub = s.submission;
              const d = sub ? drafts[sub.id] : null;
              return (
                <tr key={s.student_id} style={{ verticalAlign: 'top' }}>
                  <td><div className="fp-strong" style={{ fontWeight: 700, color: '#0f172a' }}>{s.name}</div><div className="fp-mono" style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '0.74rem', color: '#94a3b8' }}>{s.enrollment_no}</div></td>
                  <td>
                    {sub ? (
                      <>
                        {sub.file_url && <a href={sub.file_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', gap: 5, alignItems: 'center', color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}><FileText size={14} /> Open</a>}
                        <div style={{ fontSize: '0.72rem', color: sub.late ? '#dc2626' : '#888' }}>{formatDateTime(sub.submitted_at)}{sub.late ? ' · late' : ''}</div>
                      </>
                    ) : <span className="fp-pill fp-pill-gray">Not submitted</span>}
                  </td>
                  <td>
                    {sub && <input type="number" min="0" max={a.total_marks} step="0.5" className="fp-input" style={{ width: 90 }} value={d?.grade ?? ''} onChange={(e) => setDrafts((x) => ({ ...x, [sub.id]: { ...x[sub.id], grade: e.target.value } }))} />}
                  </td>
                  <td>
                    {sub && <textarea rows={2} maxLength={2000} className="fp-input" style={{ minWidth: 200 }} value={d?.feedback ?? ''} onChange={(e) => setDrafts((x) => ({ ...x, [sub.id]: { ...x[sub.id], feedback: e.target.value } }))} />}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {sub && (
                      <>
                        <button disabled={saving[sub.id]} onClick={() => save(sub)} className="fp-btn fp-btn-sm fp-btn-primary"><Check size={13} /> Save</button>
                        <div style={{ fontSize: '0.7rem', color: msg[sub.id] === 'Saved' ? '#16a34a' : '#dc2626', marginTop: 3 }}>{msg[sub.id]}</div>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {students.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>No students enrolled.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
