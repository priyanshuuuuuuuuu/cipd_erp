'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

function mondayOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const back = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - back);
  return d;
}

const STATUS_STYLE = {
  Scheduled: { bg: '#ecfdf5', border: '#16a34a', color: '#166534' },
  Completed: { bg: '#eff6ff', border: '#2563eb', color: '#1d4ed8' },
  Cancelled: { bg: '#fef2f2', border: '#dc2626', color: '#991b1b' },
};

export default function WeekCalendar() {
  const router = useRouter();
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; }),
    [weekStart]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/faculty/schedule?from=${fmt(days[0])}&to=${fmt(days[6])}`);
      setSessions(res.sessions || []);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const shift = (weeks) => setWeekStart((w) => { const d = new Date(w); d.setDate(d.getDate() + weeks * 7); return d; });
  const todayStr = fmt(new Date());
  const rangeLabel = `${days[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  const btn = { border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '0.8rem', fontWeight: 600 };

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e8e8', padding: '1.2rem 1.5rem', marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>This week&apos;s classes <span style={{ color: '#888', fontWeight: 500, fontSize: '0.8rem', marginLeft: 8 }}>{rangeLabel}</span></div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={btn} onClick={() => shift(-1)} aria-label="Previous week"><ChevronLeft size={14} /></button>
          <button style={btn} onClick={() => setWeekStart(mondayOf(new Date()))}>Today</button>
          <button style={btn} onClick={() => shift(1)} aria-label="Next week"><ChevronRight size={14} /></button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, opacity: loading ? 0.5 : 1 }}>
        {days.map((d, i) => {
          const ds = fmt(d);
          const items = sessions.filter((s) => s.date === ds).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
          const isToday = ds === todayStr;
          return (
            <div key={ds} style={{ border: `1px solid ${isToday ? '#00A5A0' : '#f0f0f0'}`, borderRadius: 10, padding: 8, background: isToday ? '#f0fdfa' : '#fafafa', minHeight: 110 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: isToday ? '#0f766e' : '#555', marginBottom: 6 }}>
                {DAY_NAMES[i]} {d.getDate()}
              </div>
              {items.length === 0 && <div style={{ fontSize: '0.7rem', color: '#bbb' }}>No classes</div>}
              {items.map((s) => {
                const st = STATUS_STYLE[s.status] || STATUS_STYLE.Scheduled;
                return (
                  <div
                    key={s.id}
                    onClick={() => router.push(`/faculty/schedule/${s.id}`)}
                    style={{ cursor: 'pointer', background: st.bg, borderLeft: `3px solid ${st.border}`, borderRadius: 6, padding: '6px 8px', marginBottom: 6 }}
                  >
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: st.color }}>{s.time}–{s.endTime}</div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#111', lineHeight: 1.25 }}>{s.course}</div>
                    <div style={{ fontSize: '0.68rem', color: '#666', display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={10} />{s.venue}</div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
