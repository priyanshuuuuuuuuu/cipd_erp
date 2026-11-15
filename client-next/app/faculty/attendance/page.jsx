'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, MapPin, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '@/lib/api';

const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const shiftDay = (s, n) => { const [y, m, d] = s.split('-').map(Number); return fmt(new Date(y, m - 1, d + n)); };

const STATUS = {
  present: { bg: '#dcfce7', color: '#166534', label: 'Present' },
  partial: { bg: '#fef9c3', color: '#92400e', label: 'Partial' },
  leave: { bg: '#e0e7ff', color: '#3730a3', label: 'Leave' },
  absent: { bg: '#fee2e2', color: '#991b1b', label: 'Absent' },
  unverified: { bg: '#f3f4f6', color: '#555', label: 'Not tracked' },
};
const Pill = ({ status }) => {
  const s = STATUS[status] || STATUS.unverified;
  return <span style={{ padding: '2px 9px', borderRadius: 8, fontSize: '0.72rem', fontWeight: 600, background: s.bg, color: s.color }}>{s.label}</span>;
};

export default function FacultyAttendancePage() {
  const { authReady } = useAuth();
  const [date, setDate] = useState(fmt(new Date()));
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState({}); // sessionId -> { loading, data, error }

  const load = useCallback(async () => {
    setLoading(true); setError(''); setOpenId(null);
    try {
      const res = await api.get(`/api/faculty/attendance/sessions?date=${date}`);
      setSessions(res.sessions || []);
    } catch (e) {
      setError(e.message || 'Failed to load sessions'); setSessions([]);
    } finally { setLoading(false); }
  }, [date]);

  useEffect(() => { if (authReady) load(); }, [authReady, load]);

  const toggle = async (id) => {
    if (openId === id) return setOpenId(null);
    setOpenId(id);
    if (detail[id]?.data) return;
    setDetail((d) => ({ ...d, [id]: { loading: true } }));
    try {
      const data = await api.get(`/api/faculty/attendance/session-students?session_id=${id}`);
      setDetail((d) => ({ ...d, [id]: { data } }));
    } catch (e) {
      setDetail((d) => ({ ...d, [id]: { error: e.message || 'Failed to load attendance' } }));
    }
  };

  const card = { background: '#fff', borderRadius: 12, border: '1px solid #e8e8e8', marginBottom: 12 };
  const nav = { border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center' };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#111', margin: 0 }}>Attendance</h1>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button style={nav} onClick={() => setDate(shiftDay(date, -1))} aria-label="Previous day"><ChevronLeft size={14} /></button>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb' }} />
          <button style={nav} onClick={() => setDate(shiftDay(date, 1))} aria-label="Next day"><ChevronRight size={14} /></button>
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>Loading...</div>}
      {error && <div style={{ color: '#dc2626', marginBottom: 12 }}>{error}</div>}
      {!loading && !error && sessions.length === 0 && <div style={{ ...card, textAlign: 'center', padding: '2.5rem', color: '#aaa' }}>You have no classes on this date.</div>}

      {sessions.map((s) => {
        const d = detail[s.id];
        const open = openId === s.id;
        return (
          <div key={s.id} style={card}>
            <div onClick={() => toggle(s.id)} style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{s.courseName || s.title}</div>
                <div style={{ fontSize: '0.75rem', color: '#777', marginTop: 3, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <span>{s.startTime?.slice(0, 5)} – {s.endTime?.slice(0, 5)}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><MapPin size={11} />{s.venueName || 'TBA'}</span>
                  <span style={{ textTransform: 'capitalize' }}>{s.status}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.85rem', fontWeight: 600 }}><Users size={15} color="#2563eb" />{s.detectedStudents} attended</span>
                {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>

            {open && (
              <div style={{ borderTop: '1px solid #f0f0f0', padding: '12px 18px' }}>
                {d?.loading && <div style={{ color: '#888', fontSize: '0.85rem' }}>Loading students…</div>}
                {d?.error && <div style={{ color: '#dc2626', fontSize: '0.85rem' }}>{d.error}</div>}
                {d?.data && (
                  <>
                    <div style={{ display: 'flex', gap: 16, fontSize: '0.8rem', marginBottom: 10, flexWrap: 'wrap' }}>
                      <span>Enrolled: <b>{d.data.summary.enrolled}</b></span>
                      <span style={{ color: '#166534' }}>Present: <b>{d.data.summary.present}</b></span>
                      <span style={{ color: '#92400e' }}>Partial: <b>{d.data.summary.partial}</b></span>
                      <span style={{ color: '#991b1b' }}>Absent: <b>{d.data.summary.absent}</b></span>
                      <span style={{ color: '#3730a3' }}>Leave: <b>{d.data.summary.leave}</b></span>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                          <tr style={{ textAlign: 'left', color: '#888', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                            <th style={{ padding: '6px 8px' }}>Student</th><th style={{ padding: '6px 8px' }}>Enrollment</th><th style={{ padding: '6px 8px' }}>Status</th><th style={{ padding: '6px 8px' }}>Time in class</th>
                          </tr>
                        </thead>
                        <tbody>
                          {d.data.students.map((st) => (
                            <tr key={st.studentId} style={{ borderTop: '1px solid #f3f3f3' }}>
                              <td style={{ padding: '7px 8px', fontWeight: 600 }}>{st.name}</td>
                              <td style={{ padding: '7px 8px', fontFamily: 'monospace', color: '#555' }}>{st.enrollmentNo || '—'}</td>
                              <td style={{ padding: '7px 8px' }}><Pill status={st.status} /></td>
                              <td style={{ padding: '7px 8px', color: '#555' }}>{st.durationMinutes ? `${Math.round(st.durationMinutes)} min` : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
