'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function mondayOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const back = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - back);
  return d;
}

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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <span className="fp-tag">{rangeLabel}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="fp-btn fp-btn-sm fp-btn-icon" onClick={() => shift(-1)} aria-label="Previous week"><ChevronLeft size={14} /></button>
          <button className="fp-btn fp-btn-sm" onClick={() => setWeekStart(mondayOf(new Date()))}>Today</button>
          <button className="fp-btn fp-btn-sm fp-btn-icon" onClick={() => shift(1)} aria-label="Next week"><ChevronRight size={14} /></button>
        </div>
      </div>

      <div className="fp-week" style={{ opacity: loading ? 0.5 : 1 }}>
        {days.map((d, i) => {
          const ds = fmt(d);
          const items = sessions.filter((s) => s.date === ds).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
          const isToday = ds === todayStr;
          return (
            <div key={ds} className={`fp-day ${isToday ? 'fp-today' : ''}`}>
              <div className="fp-day-head"><small>{DAY_NAMES[i]}</small><b>{d.getDate()}</b></div>
              {items.length === 0 && <div className="fp-nocls">No classes</div>}
              {items.map((s) => (
                <div
                  key={s.id}
                  className={`fp-event fp-ev-${STATUS_KEYS.includes(s.status) ? s.status : 'Scheduled'}`}
                  onClick={() => router.push(`/faculty/schedule/${s.id}`)}
                >
                  <div className="t">{s.time}–{s.endTime}</div>
                  <div className="c">{s.course}</div>
                  <div className="v"><MapPin size={10} />{s.venue}</div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const STATUS_KEYS = ['Scheduled', 'Completed', 'Cancelled'];
