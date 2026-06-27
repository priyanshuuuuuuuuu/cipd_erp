'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Clock, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '@/lib/api';

export default function FacultyProfilePage() {
  const { user, authReady } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [hours, setHours] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [meRes, hoursRes] = await Promise.allSettled([
        api.get('/api/auth/me'),
        api.get('/api/faculty/hours'),
      ]);

      if (meRes.status === 'fulfilled') {
        setProfile(meRes.value.user || meRes.value);
      }
      if (hoursRes.status === 'fulfilled') {
        setHours(hoursRes.value);
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
    marginBottom: '1.5rem',
  };

  const displayName = user
    ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
    : '';

  return (
    <>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1.5rem', color: '#111' }}>
        Hours & Profile
      </h1>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>Loading...</div>
      ) : (
        <>
          <div style={cardStyle}>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={16} /> Profile
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem' }}>
              <div><span style={{ color: '#888' }}>Name</span><div style={{ fontWeight: 600, color: '#111', marginTop: '2px' }}>{displayName}</div></div>
              <div><span style={{ color: '#888' }}>Email</span><div style={{ fontWeight: 600, color: '#111', marginTop: '2px' }}>{user?.email}</div></div>
              <div><span style={{ color: '#888' }}>Designation</span><div style={{ fontWeight: 600, color: '#111', marginTop: '2px' }}>{profile?.designation || hours?.profile?.designation || '—'}</div></div>
              <div><span style={{ color: '#888' }}>Department</span><div style={{ fontWeight: 600, color: '#111', marginTop: '2px' }}>{profile?.department || hours?.profile?.department || '—'}</div></div>
              <div><span style={{ color: '#888' }}>Experience</span><div style={{ fontWeight: 600, color: '#111', marginTop: '2px' }}>{profile?.years_experience ?? hours?.profile?.years_experience ?? '—'} years</div></div>
              <div>
                <span style={{ color: '#888' }}>Honorarium Rate</span>
                <div style={{ fontWeight: 600, color: '#111', marginTop: '2px' }}>
                  ₹{(hours?.profile?.honorarium_rate_per_hour || profile?.honorarium_rate_per_hour || 0).toLocaleString()} / hr
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
            {[
              { label: 'Total Sessions', value: hours?.totalSessionCount ?? 0 },
              { label: 'Completed', value: hours?.completedSessions ?? 0 },
              { label: 'Total Hours', value: `${hours?.totalHours ?? 0}h` },
            ].map((s) => (
              <div key={s.label} style={{ ...cardStyle, marginBottom: 0, textAlign: 'center' }}>
                <div style={{ fontSize: '0.78rem', color: '#888', marginBottom: '6px' }}>{s.label}</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#111' }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={16} /> Session History
              <span style={{ marginLeft: 'auto', fontSize: '0.82rem', color: '#7c3aed', fontWeight: 600 }}>
                Est. Honorarium: ₹{(hours?.estimatedHonorarium || 0).toLocaleString()}
              </span>
            </div>
            {(hours?.sessions || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#aaa' }}>No sessions recorded.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                      {['Date', 'Session', 'Course', 'Venue', 'Duration', 'Status'].map((h) => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#888', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(hours?.sessions || []).map((s) => (
                      <tr key={s.session_id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#555' }}>{s.date}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: '#111' }}>{s.title}</td>
                        <td style={{ padding: '10px 12px', color: '#555' }}>{s.course}</td>
                        <td style={{ padding: '10px 12px', color: '#555' }}>{s.venue}</td>
                        <td style={{ padding: '10px 12px', color: '#555' }}>{s.duration}</td>
                        <td style={{ padding: '10px 12px', color: '#555', textTransform: 'capitalize' }}>{s.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
