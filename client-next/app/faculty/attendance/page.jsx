'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, MapPin, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '@/lib/api';
import { PageHeader, Loading, Empty, StatusPill } from '../components/ui';

const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const shiftDay = (s, n) => { const [y, m, d] = s.split('-').map(Number); return fmt(new Date(y, m - 1, d + n)); };

const STATUS_LABEL = { partial: 'Partial', leave: 'Leave', present: 'Present', absent: 'Absent', unverified: 'Not tracked' };
const Pill = ({ status }) => <StatusPill status={status} label={STATUS_LABEL[status] || 'Not tracked'} />;

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

  return (
    <>
      <PageHeader icon={CheckCircle} title="Attendance" subtitle="See who attended each of your classes.">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button className="fp-btn fp-btn-icon" onClick={() => setDate(shiftDay(date, -1))} aria-label="Previous day"><ChevronLeft size={15} /></button>
          <input type="date" className="fp-input" style={{ width: 'auto' }} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <button className="fp-btn fp-btn-icon" onClick={() => setDate(shiftDay(date, 1))} aria-label="Next day"><ChevronRight size={15} /></button>
        </div>
      </PageHeader>

      {loading && <Loading />}
      {error && <div className="fp-msg fp-msg-error" style={{ marginTop: 0, marginBottom: 12 }}>{error}</div>}
      {!loading && !error && sessions.length === 0 && (
        <div className="fp-card"><Empty icon={CheckCircle} title="No classes on this date">Pick another day to see attendance.</Empty></div>
      )}

      {sessions.map((s) => {
        const d = detail[s.id];
        const open = openId === s.id;
        return (
          <div key={s.id} className="fp-card">
            <div onClick={() => toggle(s.id)} style={{ padding: '16px 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>{s.courseName || s.title}</div>
                <div className="fp-session-sub" style={{ marginTop: 5 }}>
                  <span className="fp-mono" style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontWeight: 600 }}>{s.startTime?.slice(0, 5)} – {s.endTime?.slice(0, 5)}</span>
                  <span><MapPin size={12} />{s.venueName || 'TBA'}</span>
                  <StatusPill status={s.status} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span className="fp-pill fp-pill-blue" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Users size={14} />{s.detectedStudents} attended</span>
                {open ? <ChevronUp size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#94a3b8" />}
              </div>
            </div>

            {open && (
              <div style={{ borderTop: '1px solid #f1f5f9', padding: '14px 1.5rem', background: '#fff' }}>
                {d?.loading && <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Loading students…</div>}
                {d?.error && <div className="fp-msg fp-msg-error" style={{ marginTop: 0 }}>{d.error}</div>}
                {d?.data && (
                  <>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                      <span className="fp-pill fp-pill-gray">Enrolled: {d.data.summary.enrolled}</span>
                      <span className="fp-pill fp-pill-green">Present: {d.data.summary.present}</span>
                      <span className="fp-pill fp-pill-amber">Partial: {d.data.summary.partial}</span>
                      <span className="fp-pill fp-pill-red">Absent: {d.data.summary.absent}</span>
                      <span className="fp-pill fp-pill-violet">Leave: {d.data.summary.leave}</span>
                    </div>
                    <div className="fp-table-wrap" style={{ border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff' }}>
                      <table className="fp-table">
                        <thead>
                          <tr><th>Student</th><th>Enrollment</th><th>Status</th><th>Time in class</th></tr>
                        </thead>
                        <tbody>
                          {d.data.students.map((st) => (
                            <tr key={st.studentId}>
                              <td className="fp-strong">{st.name}</td>
                              <td className="fp-mono">{st.enrollmentNo || '—'}</td>
                              <td><Pill status={st.status} /></td>
                              <td>{st.durationMinutes ? `${Math.round(st.durationMinutes)} min` : '—'}</td>
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
