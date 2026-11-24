'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, BookOpen, ChevronRight, IndianRupee, MapPin, CheckCircle, Megaphone, CalendarOff, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '@/lib/api';
import WeekCalendar from '../components/WeekCalendar';
import { Loading, Empty, StatTile } from '../components/ui';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

const dateParts = (d) => {
  const dt = new Date(`${d}T00:00:00`);
  if (isNaN(dt)) return { day: '–', mon: '' };
  return { day: dt.getDate(), mon: dt.toLocaleDateString('en-GB', { month: 'short' }) };
};

export default function FacultyDashboardPage() {
  const router = useRouter();
  const { authReady, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [upcoming, setUpcoming] = useState([]);
  const [summary, setSummary] = useState({ totalHours: 0, completedSessions: 0, estimatedHonorarium: 0 });

  const fetchData = useCallback(async () => {
    try {
      const [schedRes, hoursRes] = await Promise.allSettled([
        api.get('/api/faculty/schedule?upcoming=true'),
        api.get('/api/faculty/hours'),
      ]);

      if (schedRes.status === 'fulfilled') {
        setUpcoming((schedRes.value.sessions || []).slice(0, 5));
      }
      if (hoursRes.status === 'fulfilled') {
        setSummary({
          totalHours: hoursRes.value.totalHours || 0,
          completedSessions: hoursRes.value.completedSessions || 0,
          estimatedHonorarium: hoursRes.value.estimatedHonorarium || 0,
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authReady) fetchData();
  }, [authReady, fetchData]);

  const name = user?.firstName || 'Professor';
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <>
      <div className="fp-hero">
        <div>
          <div className="fp-kicker">{today}</div>
          <h2>{greeting()}, {name}.</h2>
          <p>
            {loading
              ? 'Loading your schedule…'
              : upcoming.length > 0
                ? `${upcoming.length} upcoming session${upcoming.length > 1 ? 's' : ''} on your calendar.`
                : 'Nothing scheduled ahead. Your calendar is clear.'}
          </p>
        </div>
        {!loading && upcoming[0] && (
          <div className="fp-hero-chip" style={{ cursor: 'pointer' }} onClick={() => router.push(`/faculty/schedule/${upcoming[0].id}`)}>
            <span>Up next · {upcoming[0].date}</span>
            <b>{upcoming[0].time}</b>
            <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>{upcoming[0].course} · {upcoming[0].venue}</span>
          </div>
        )}
      </div>

      <div className="fp-quick">
        {[
          { label: 'Mark attendance', sub: 'See who came', icon: CheckCircle, tone: 'green', to: '/faculty/attendance' },
          { label: 'Notify students', sub: 'Send an announcement', icon: Megaphone, tone: 'blue', to: '/faculty/notifications' },
          { label: 'Apply for leave', sub: 'Request time off', icon: CalendarOff, tone: 'orange', to: '/faculty/leave' },
          { label: 'Statement', sub: 'Monthly honorarium', icon: FileText, tone: 'ink', to: '/faculty/statement' },
        ].map((q) => (
          <button key={q.to} className={`fp-quick-item fp-q-${q.tone}`} onClick={() => router.push(q.to)}>
            <i><q.icon size={18} /></i>
            <span>{q.label}<small>{q.sub}</small></span>
          </button>
        ))}
      </div>

      {loading ? (
        <Loading />
      ) : (
        <>
          <div className="fp-stats">
            <StatTile label="Completed" value={summary.completedSessions} icon={BookOpen} tone="blue" note="classes taught" />
            <StatTile label="Teaching hrs" value={`${summary.totalHours}h`} icon={Clock} tone="amber" note="in the classroom" />
            <StatTile label="Honorarium" value={`₹${summary.estimatedHonorarium.toLocaleString()}`} icon={IndianRupee} tone="violet" note="estimated, before payout" />
          </div>

          <div className="fp-card">
            <div className="fp-card-head">
              <Calendar size={17} /> This week&apos;s classes
            </div>
            <div className="fp-card-body"><WeekCalendar /></div>
          </div>

          <div className="fp-card">
            <div className="fp-card-head">
              <Calendar size={17} /> Upcoming Sessions
              <span className="fp-spacer" />
              <button className="fp-link" onClick={() => router.push('/faculty/schedule')}>
                View all <ChevronRight size={14} />
              </button>
            </div>

            {upcoming.length === 0 ? (
              <Empty icon={Calendar} title="All clear">No upcoming sessions scheduled.</Empty>
            ) : (
              upcoming.map((s) => {
                const { day, mon } = dateParts(s.date);
                return (
                  <div key={s.id} className="fp-session" onClick={() => router.push(`/faculty/schedule/${s.id}`)}>
                    <div className="fp-date-chip"><b>{day}</b><span>{mon}</span></div>
                    <div className="fp-session-main">
                      <div className="fp-session-title">{s.title}</div>
                      <div className="fp-session-sub">
                        <span className="fp-tag" style={{ padding: '2px 8px', fontSize: '0.7rem' }}>{s.course}</span>
                        <span><MapPin size={12} />{s.venue}</span>
                      </div>
                    </div>
                    <div style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontWeight: 700, fontSize: '0.8rem', color: '#475569', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {s.time} – {s.endTime}
                    </div>
                    <ChevronRight size={16} color="#cbd5e1" />
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </>
  );
}
