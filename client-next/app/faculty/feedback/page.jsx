'use client';

import React, { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '@/lib/api';
import { PageHeader, Loading, Empty, StatTile } from '../components/ui';
import { MessageSquareText, ClipboardCheck } from 'lucide-react';

const Rating = ({ v }) => (v == null ? <span style={{ color: '#cbd5e1' }}>—</span> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700 }}><Star size={14} color="#f59e0b" fill="#f59e0b" />{v.toFixed(2)}</span>);

export default function FacultyFeedbackPage() {
  const { authReady } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);

  useEffect(() => {
    if (!authReady) return;
    api.get('/api/faculty/feedback').then(setData).catch((e) => setError(e.message || 'Failed to load feedback'));
  }, [authReady]);

  if (error) return <div className="fp-msg fp-msg-error">{error}</div>;
  if (!data) return <Loading />;

  return (
    <>
      <PageHeader icon={Star} title="Student Feedback" subtitle="Anonymous ratings and comments from your classes." />
      <div className="fp-stats">
        <StatTile label="Overall rating" value={data.overall.avg_rating == null ? '—' : data.overall.avg_rating.toFixed(2)} icon={Star} tone="amber" />
        <StatTile label="Classes rated" value={data.overall.sessions_rated} icon={ClipboardCheck} tone="violet" />
        <StatTile label="Responses" value={data.overall.responses} icon={MessageSquareText} tone="blue" />
      </div>

      {data.modules.length > 0 && (
        <div className="fp-card">
          <div className="fp-card-head">By module</div>
          {data.modules.map((m) => (
            <div key={m.course_id} className="fp-row">
              <span style={{ fontWeight: 600, color: '#0f172a' }}>{m.course_name} <span style={{ color: '#94a3b8', fontWeight: 500 }}>· {m.sessions} classes</span></span>
              <Rating v={m.avg_rating} />
            </div>
          ))}
        </div>
      )}

      <div className="fp-card">
        <div className="fp-card-head">By class</div>
        {data.sessions.length === 0 && <Empty icon={Star} title="No feedback received yet" />}
        {data.sessions.map((s) => (
          <div key={s.session_id} style={{ borderTop: '1px solid #f1f5f9' }}>
            <div className="fp-row fp-clickable" style={{ borderTop: 'none' }} onClick={() => setOpen(open === s.session_id ? null : s.session_id)}>
              <span><b style={{ color: '#0f172a' }}>{s.course_name}</b> · {s.title} <span style={{ color: '#94a3b8' }}>· {s.date} · {s.responses} responses</span></span>
              <Rating v={s.avg_rating} />
            </div>
            {open === s.session_id && (
              <div style={{ padding: '4px 1.5rem 16px', fontSize: '0.82rem', background: '#fff' }}>
                {s.questions.map((q) => <div key={q.question} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', color: '#475569' }}><span>{q.question}</span><Rating v={q.avg} /></div>)}
                {s.comments.length > 0 && <div style={{ marginTop: 10, fontWeight: 700, color: '#0f172a' }}>Comments (anonymous)</div>}
                {s.comments.map((c, i) => <div key={i} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 12px', margin: '6px 0', whiteSpace: 'pre-wrap' }}>{c}</div>)}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
