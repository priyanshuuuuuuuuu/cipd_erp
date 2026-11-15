'use client';

import React, { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '@/lib/api';

const card = { background: '#fff', border: '1px solid #e8e8e8', borderRadius: 12, padding: '1rem 1.2rem', marginBottom: 14 };
const Rating = ({ v }) => (v == null ? <span style={{ color: '#bbb' }}>—</span> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700 }}><Star size={14} color="#f59e0b" fill="#f59e0b" />{v.toFixed(2)}</span>);

export default function FacultyFeedbackPage() {
  const { authReady } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);

  useEffect(() => {
    if (!authReady) return;
    api.get('/api/faculty/feedback').then(setData).catch((e) => setError(e.message || 'Failed to load feedback'));
  }, [authReady]);

  if (error) return <div style={{ color: '#dc2626' }}>{error}</div>;
  if (!data) return <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>Loading...</div>;

  return (
    <>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1.2rem' }}>Student Feedback</h1>
      <div style={{ ...card, display: 'flex', gap: 28, flexWrap: 'wrap' }}>
        <div><div style={{ fontSize: '0.72rem', color: '#888' }}>Overall rating</div><div style={{ fontSize: '1.5rem' }}><Rating v={data.overall.avg_rating} /></div></div>
        <div><div style={{ fontSize: '0.72rem', color: '#888' }}>Classes rated</div><div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{data.overall.sessions_rated}</div></div>
        <div><div style={{ fontSize: '0.72rem', color: '#888' }}>Responses</div><div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{data.overall.responses}</div></div>
      </div>

      {data.modules.length > 0 && (
        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>By module</div>
          {data.modules.map((m) => (
            <div key={m.course_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #f3f3f3', fontSize: '0.85rem' }}>
              <span>{m.course_name} <span style={{ color: '#aaa' }}>· {m.sessions} classes</span></span><Rating v={m.avg_rating} />
            </div>
          ))}
        </div>
      )}

      <div style={card}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>By class</div>
        {data.sessions.length === 0 && <div style={{ color: '#aaa', fontSize: '0.85rem' }}>No feedback received yet.</div>}
        {data.sessions.map((s) => (
          <div key={s.session_id} style={{ borderTop: '1px solid #f3f3f3', padding: '8px 0' }}>
            <div onClick={() => setOpen(open === s.session_id ? null : s.session_id)} style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer', fontSize: '0.85rem', gap: 10 }}>
              <span><b>{s.course_name}</b> · {s.title} <span style={{ color: '#aaa' }}>· {s.date} · {s.responses} responses</span></span><Rating v={s.avg_rating} />
            </div>
            {open === s.session_id && (
              <div style={{ marginTop: 8, fontSize: '0.8rem' }}>
                {s.questions.map((q) => <div key={q.question} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: '#555' }}><span>{q.question}</span><Rating v={q.avg} /></div>)}
                {s.comments.length > 0 && <div style={{ marginTop: 8, fontWeight: 600 }}>Comments (anonymous)</div>}
                {s.comments.map((c, i) => <div key={i} style={{ background: '#fafafa', borderRadius: 8, padding: '6px 10px', margin: '4px 0', whiteSpace: 'pre-wrap' }}>{c}</div>)}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
