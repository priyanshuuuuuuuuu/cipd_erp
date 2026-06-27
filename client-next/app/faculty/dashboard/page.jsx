'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, BookOpen, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '@/lib/api';

export default function FacultyDashboardPage() {
  const router = useRouter();
  const { authReady } = useAuth();
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

  const cardStyle = {
    background: '#fff',
    borderRadius: '12px',
    border: '1px solid #e8e8e8',
    borderTop: '3px solid #00A5A0',
    padding: '1.2rem 1.5rem',
  };

  return (
    <>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1.5rem', color: '#111' }}>
        Faculty Dashboard
      </h1>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>Loading...</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
            {[
              { label: 'Completed Sessions', value: summary.completedSessions, icon: BookOpen, color: '#2563eb' },
              { label: 'Total Hours', value: `${summary.totalHours}h`, icon: Clock, color: '#16a34a' },
              { label: 'Est. Honorarium', value: `₹${summary.estimatedHonorarium.toLocaleString()}`, icon: Calendar, color: '#7c3aed' },
            ].map((stat) => (
              <div key={stat.label} style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <stat.icon size={18} color={stat.color} />
                  <span style={{ fontSize: '0.78rem', color: '#888', fontWeight: 500 }}>{stat.label}</span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111' }}>{stat.value}</div>
              </div>
            ))}
          </div>

          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={16} /> Upcoming Sessions
              </div>
              <button
                onClick={() => router.push('/faculty/schedule')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.78rem', color: '#2563eb', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                View all <ChevronRight size={14} />
              </button>
            </div>

            {upcoming.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#aaa', fontSize: '0.85rem' }}>
                No upcoming sessions scheduled.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {upcoming.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: '#fafafa',
                      borderRadius: '8px',
                      border: '1px solid #f0f0f0',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#111' }}>{s.title}</div>
                      <div style={{ fontSize: '0.72rem', color: '#888', marginTop: '2px' }}>
                        {s.course} · {s.venue}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#555' }}>
                      <div>{s.date}</div>
                      <div>{s.time} – {s.endTime}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
